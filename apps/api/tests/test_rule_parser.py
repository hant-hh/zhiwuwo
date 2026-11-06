from datetime import date

from app.services.rule_parser import parse, parse_text


def test_item_extraction_with_ba():
    r = parse_text("昨天把护照放在抽屉")
    assert r["item"] == "护照"


def test_location_extraction():
    r = parse_text("昨天把护照放在抽屉")
    assert r["location"] == "抽屉"


def test_date_yesterday():
    r = parse_text("昨天把护照放在抽屉")
    assert r["placed_at"] == (date.today() - __import__("datetime").timedelta(days=1)).isoformat()


def test_date_explicit_month_day():
    r = parse_text("我把合同放在书房，11月4日放的")
    assert r["placed_at"] == date(date.today().year, 11, 4).isoformat()


def test_confidence_full_when_item_and_location():
    r = parse_text("昨天把护照放在抽屉")
    assert r["confidence"] == 1.0


def test_confidence_half_when_missing_location():
    r = parse_text("我把钥匙放好了")
    assert r["item"] == "钥匙"
    assert r["location"] is None
    assert r["confidence"] == 0.5


def test_confidence_half_when_missing_item():
    r = parse_text("放在抽屉里了")
    assert r["item"] is None
    assert r["location"] == "抽屉"
    assert r["confidence"] == 0.5


def test_parse_alias_matches_parse_text():
    content = "我把雨伞放在客厅茶几上"
    assert parse(content) == parse_text(content)
