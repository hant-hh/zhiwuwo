"""Agnes 2.5 Flash 解析器与调度器单测（全部 mock，不触网）。"""

from datetime import date, timedelta

import httpx
import pytest

from app.core.config import settings
from app.services import agnes_parser
from app.services.agnes_parser import AgnesParser, _extract_json, _normalize
from app.services.dispatcher import get_parser, parse
from app.services.rule_parser import RuleParser

BASE_URL = "https://api.agnes-ai.cn/v1"


class _FakeResponse:
    def __init__(self, content: str) -> None:
        self._content = content

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return {"choices": [{"message": {"content": self._content}}]}


def _parser_with(monkeypatch, content: str):
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured.update(url=url, headers=headers, payload=json, timeout=timeout)
        return _FakeResponse(content)

    monkeypatch.setattr(agnes_parser.httpx, "post", fake_post)
    parser = AgnesParser(
        api_key="test-key",
        base_url=BASE_URL,
        model="agnes-2.5-flash",
    )
    return parser, captured


def test_chat_completions_request_shape(monkeypatch):
    parser, captured = _parser_with(
        monkeypatch,
        '{"item":"护照","location":"书房第二个抽屉","placed_at":null,"note":null,"confidence":0.95}',
    )
    result = parser.parse("昨天把护照放在书房第二个抽屉")

    assert captured["url"] == f"{BASE_URL}/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["payload"]["model"] == "agnes-2.5-flash"
    assert captured["payload"]["temperature"] == 0
    assert captured["payload"]["messages"][0]["role"] == "system"
    assert str(date.today()) in captured["payload"]["messages"][0]["content"]

    assert result["item"] == "护照"
    assert result["location"] == "书房第二个抽屉"
    assert result["confidence"] == 1.0
    assert result["placed_at"] == date.today().isoformat()


def test_markdown_fence_and_relative_date(monkeypatch):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    parser, _ = _parser_with(
        monkeypatch,
        f'```json\n{{"item":"医保卡","location":"玄关柜最上面那层",'
        f'"placed_at":"{yesterday}","note":null,"confidence":0.9}}\n```',
    )
    result = parser.parse("昨天把医保卡塞进玄关柜最上面那层")
    assert result["location"] == "玄关柜最上面那层"
    assert result["placed_at"] == yesterday


def test_invalid_date_and_low_confidence(monkeypatch):
    parser, _ = _parser_with(
        monkeypatch,
        '{"item":"钥匙","location":null,"placed_at":"不是日期","note":null,"confidence":0.3}',
    )
    result = parser.parse("钥匙不知道放哪了")
    assert result["placed_at"] == date.today().isoformat()
    assert result["confidence"] == 0.5


def test_extract_json_rejects_garbage():
    with pytest.raises(ValueError):
        _extract_json("抱歉，我无法理解这句话")
    assert _normalize({})["confidence"] == 0.0


def test_dispatcher_uses_rule_without_key(monkeypatch):
    monkeypatch.setattr(settings, "parser_backend", "llm")
    monkeypatch.setattr(settings, "llm_api_key", "")
    assert isinstance(get_parser(), RuleParser)


def test_dispatcher_uses_agnes_when_configured(monkeypatch):
    monkeypatch.setattr(settings, "parser_backend", "llm")
    monkeypatch.setattr(settings, "llm_api_key", "fake-key")
    monkeypatch.setattr(settings, "llm_consent", True)
    assert get_parser().name == "agnes-2.5-flash"


def test_dispatcher_respects_consent_switch(monkeypatch):
    monkeypatch.setattr(settings, "parser_backend", "llm")
    monkeypatch.setattr(settings, "llm_api_key", "fake-key")
    monkeypatch.setattr(settings, "llm_consent", False)
    assert isinstance(get_parser(), RuleParser)


def test_dispatcher_falls_back_on_timeout(monkeypatch):
    monkeypatch.setattr(settings, "parser_backend", "llm")
    monkeypatch.setattr(settings, "llm_api_key", "fake-key")
    monkeypatch.setattr(settings, "llm_consent", True)

    def boom(url, headers=None, json=None, timeout=None):
        raise httpx.TimeoutException("timeout")

    monkeypatch.setattr(agnes_parser.httpx, "post", boom)
    content = "昨天把护照放在抽屉"
    assert parse(content) == RuleParser().parse(content)


def test_dispatcher_falls_back_on_bad_json(monkeypatch):
    monkeypatch.setattr(settings, "parser_backend", "llm")
    monkeypatch.setattr(settings, "llm_api_key", "fake-key")
    monkeypatch.setattr(settings, "llm_consent", True)
    _, _ = _parser_with(monkeypatch, "这不是 JSON")
    content = "昨天把护照放在抽屉"
    assert parse(content) == RuleParser().parse(content)


def test_parser_status_endpoint(client):
    r = client.get("/api/v1/parser/status")
    assert r.status_code == 200
    body = r.json()
    assert body["active_backend"] == "rule"
    assert body["api_key_configured"] is False
    assert body["model"] == "agnes-2.5-flash"
    assert body["fallback"] == "rule"
