"""对话式助手测试：中文口语理解、意图识别、增强检索、AI 回退。"""

from app.core.config import settings
from app.services import chat_service


def _auth(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"username": "chatuser", "password": "pw123456"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _record(client, headers, content):
    return client.post(
        "/api/v1/chat", json={"message": content, "mode": "record"}, headers=headers
    )


# ---------- 纯规则 ----------

def test_extract_keyword_strips_chinese_filler():
    cases = {
        "我的电脑在哪里": "电脑",
        "护照放哪了": "护照",
        "帮我找一下钥匙": "钥匙",
        "我的护照在哪儿呢": "护照",
        "电脑在哪": "电脑",
        "请问医保卡放在哪儿了": "医保卡",
        "护照": "护照",
    }
    for raw, expected in cases.items():
        assert chat_service.extract_keyword(raw) == expected, raw


def test_classify_intent():
    assert chat_service.classify("我的电脑在哪里") == "query"
    assert chat_service.classify("护照放在哪了") == "query"  # 疑问词优先
    assert chat_service.classify("我把护照放在书房第二个抽屉") == "record"
    assert chat_service.classify("帮我把雨伞放阳台") == "record"
    assert chat_service.classify("护照") == "query"  # 默认当作找东西


def test_location_list_match():
    assert chat_service._match_location_list("书房里有什么") == "书房"
    assert chat_service._match_location_list("卧室都放了啥") == "卧室"
    assert chat_service._match_location_list("我的电脑在哪里") is None


# ---------- 对话接口 ----------

def test_chat_requires_auth(client):
    r = client.post("/api/v1/chat", json={"message": "我的电脑在哪里"})
    assert r.status_code in (401, 403)


def test_natural_language_query_finds_record(client):
    """复现截图问题：整句提问应命中，而不是要求用户只输「电脑」。"""
    headers = _auth(client)
    saved = _record(client, headers, "昨天把电脑放在卧室")
    assert saved.status_code == 200
    assert saved.json()["record"]["item"] == "电脑"

    r = client.post(
        "/api/v1/chat", json={"message": "我的电脑在哪里"}, headers=headers
    )
    assert r.status_code == 200
    body = r.json()
    assert body["type"] == "query"
    assert body["intent"] == "query"
    assert "卧室" in body["answer"]
    assert len(body["records"]) == 1
    assert body["records"][0]["item"] == "电脑"


def test_auto_mode_detects_record_without_switching(client):
    headers = _auth(client)
    r = client.post(
        "/api/v1/chat", json={"message": "帮我把雨伞放阳台"}, headers=headers
    )
    assert r.status_code == 200
    assert r.json()["type"] == "record"
    assert r.json()["record"]["item"] == "雨伞"
    assert "雨伞" in r.json()["answer"]


def test_location_scope_query(client):
    headers = _auth(client)
    _record(client, headers, "把护照放在书房")
    _record(client, headers, "把合同放在书房")

    r = client.post(
        "/api/v1/chat", json={"message": "书房里有什么"}, headers=headers
    )
    body = r.json()
    assert body["type"] == "query"
    assert "书房里" in body["answer"]
    assert len(body["records"]) == 2


def test_keyword_falls_back_to_location(client):
    headers = _auth(client)
    _record(client, headers, "把护照放在玄关柜")

    # 「玄关柜」是位置不是物品名，应触发位置回退
    r = client.post("/api/v1/chat", json={"message": "玄关柜"}, headers=headers)
    assert len(r.json()["records"]) == 1


def test_zero_result_gives_actionable_hint(client):
    headers = _auth(client)
    r = client.post(
        "/api/v1/chat", json={"message": "我的机票在哪里"}, headers=headers
    )
    body = r.json()
    assert body["records"] == []
    assert "还没找到" in body["answer"]
    assert "机票" in body["answer"]


def test_force_mode_overrides_intent(client):
    headers = _auth(client)
    r = client.post(
        "/api/v1/chat",
        json={"message": "护照在哪", "mode": "record"},
        headers=headers,
    )
    assert r.json()["type"] == "record"


def test_legacy_get_query_understands_sentence(client):
    headers = _auth(client)
    _record(client, headers, "把电脑放在卧室")

    r = client.get("/api/v1/records?q=我的电脑在哪里", headers=headers)
    assert r.status_code == 200
    assert any(rec["item"] == "电脑" for rec in r.json())


# ---------- AI 分支（mock，不触网） ----------

def test_ai_understand_with_mock(monkeypatch):
    monkeypatch.setattr(settings, "parser_backend", "llm")
    monkeypatch.setattr(settings, "llm_api_key", "fake-key")
    monkeypatch.setattr(settings, "llm_consent", True)
    monkeypatch.setattr(
        chat_service,
        "call_agnes",
        lambda *a, **k: '{"intent":"query","scope":"item","item":"充电器",'
        '"location":null,"placed_at":null,"note":null,"confidence":0.9}',
    )
    u = chat_service.understand("上次出差带回来那个充电器搁哪儿了")
    assert u["source"] == "agnes"
    assert u["intent"] == "query"
    assert u["keyword"] == "充电器"


def test_ai_failure_falls_back_to_rule(monkeypatch):
    monkeypatch.setattr(settings, "parser_backend", "llm")
    monkeypatch.setattr(settings, "llm_api_key", "fake-key")
    monkeypatch.setattr(settings, "llm_consent", True)

    def boom(*args, **kwargs):
        raise RuntimeError("Agnes 挂了")

    monkeypatch.setattr(chat_service, "call_agnes", boom)
    u = chat_service.understand("我的电脑在哪里")
    assert u["source"] == "rule"
    assert u["keyword"] == "电脑"
