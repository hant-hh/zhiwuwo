def test_register_and_login(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"username": "alice", "password": "pw123456"},
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    assert token

    # 重复注册应被拒绝
    dup = client.post(
        "/api/v1/auth/register",
        json={"username": "alice", "password": "pw123456"},
    )
    assert dup.status_code == 400

    # 登录成功
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "pw123456"},
    )
    assert login.status_code == 200
    assert login.json()["access_token"]


def test_records_require_auth(client):
    r = client.post("/api/v1/records", json={"content": "把护照放在抽屉"})
    assert r.status_code in (401, 403)


def test_create_query_and_confirm_record(client):
    token = client.post(
        "/api/v1/auth/register",
        json={"username": "bob", "password": "pw123456"},
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create = client.post(
        "/api/v1/records",
        json={"content": "昨天把护照放在抽屉"},
        headers=headers,
    )
    assert create.status_code == 200
    data = create.json()
    assert data["item"] == "护照"
    assert data["location"] == "抽屉"
    assert data["confidence"] == 1.0
    record_id = data["id"]

    # 查询
    query = client.get("/api/v1/records?q=护照", headers=headers)
    assert query.status_code == 200
    assert any(rec["id"] == record_id for rec in query.json())

    # 确认
    confirm = client.post(
        f"/api/v1/records/{record_id}/confirm",
        json={"item": "护照", "location": "抽屉"},
        headers=headers,
    )
    assert confirm.status_code == 200
    assert confirm.json()["confirmed"] is True
    assert confirm.json()["confidence"] == 1.0


def test_login_wrong_password(client):
    client.post(
        "/api/v1/auth/register",
        json={"username": "carol", "password": "pw123456"},
    )
    bad = client.post(
        "/api/v1/auth/login",
        json={"username": "carol", "password": "wrong"},
    )
    assert bad.status_code == 401
