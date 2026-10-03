import datetime as dt

import pytest

from services import drafting


def test_health(client):
    assert client.get("/api/health").get_json()["status"] == "ok"


def test_match_validation(client):
    assert client.post("/api/match", json={"query": "a"}).status_code == 400


def test_match_endpoint(client):
    data = client.post("/api/match", json={"query": "my salary is not paid"}).get_json()
    assert data["laws"] and data["guide"] and data["disclaimer"]


def test_situations(client):
    items = client.get("/api/situations").get_json()["situations"]
    assert len(items) >= 10
    guide = client.get(f"/api/situations/{items[0]['id']}").get_json()
    assert guide["steps"] and guide["rights"] and guide["authorities"]
    assert client.get("/api/situations/nope").status_code == 404


def test_stats(client):
    data = client.get("/api/stats").get_json()
    assert data["counts"]["provisions"] > 100
    assert data["counts"]["chunks"] >= data["counts"]["provisions"]


SAMPLE = {
    "police_complaint": {
        "complainant_name": "Asha Verma", "complainant_address": "12 Model Town\nLudhiana", "complainant_phone": "9876543210",
        "police_station": "Model Town", "district": "Ludhiana", "incident_type": "theft of mobile phone",
        "incident_date": "2026-09-20", "incident_place": "Ghumar Mandi market", "facts": "My phone was stolen.\nI saw a man run away.",
        "place": "Ludhiana",
    },
    "consumer_complaint": {
        "complainant_name": "Asha Verma", "complainant_address": "12 Model Town, Ludhiana", "complainant_phone": "9876543210",
        "district": "Ludhiana", "op_name": "XYZ Electronics Pvt Ltd", "op_address": "Sector 17, Chandigarh",
        "product_service": "refrigerator", "purchase_date": "2026-05-01", "amount_paid": "32000",
        "facts": "The fridge stopped cooling in 10 days.\nThe service centre refused repair.",
        "refund_amount": "32000", "compensation_amount": "20000", "place": "Ludhiana",
    },
}


@pytest.mark.parametrize("template_id", drafting.load_templates().keys())
def test_every_template_renders_with_required_fields(template_id):
    t = drafting.get_template(template_id)
    values = {}
    for f in t["fields"]:
        if not f.get("required"):
            continue
        ftype = f.get("type", "text")
        values[f["name"]] = {
            "date": dt.date.today().isoformat(), "number": "15000", "tel": "9876543210", "email": "a@b.in",
            "select": (f.get("options") or [""])[0],
        }.get(ftype, "Sample text")
    clean, errors = drafting.validate(t, values)
    assert not errors, errors
    pdf = drafting.render_pdf(t, clean)
    assert pdf.startswith(b"%PDF") and len(pdf) > 1500
    text = " ".join(b.get("text", "") for b in drafting.render_blocks(t, clean))
    assert "{" not in text and "[[" not in text, "unresolved placeholders"


@pytest.mark.parametrize("template_id", SAMPLE.keys())
def test_document_endpoints(client, template_id):
    payload = {"values": SAMPLE[template_id]}
    prev = client.post(f"/api/documents/{template_id}/preview", json=payload).get_json()
    assert prev["blocks"]
    resp = client.post(f"/api/documents/{template_id}", json=payload)
    assert resp.status_code == 200 and resp.mimetype == "application/pdf"
    assert resp.data.startswith(b"%PDF")


def test_document_validation_errors(client):
    resp = client.post("/api/documents/police_complaint", json={"values": {"complainant_phone": "abc"}})
    assert resp.status_code == 400
    fields = resp.get_json()["fields"]
    assert "complainant_name" in fields and "complainant_phone" in fields


def test_number_formatting():
    assert drafting.format_inr(1234567) == "12,34,567"
    assert drafting.number_to_words_indian(250000) == "Two Lakh Fifty Thousand"
    assert drafting.number_to_words_indian(12500000) == "One Crore Twenty Five Lakh"
