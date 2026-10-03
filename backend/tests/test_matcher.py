"""Relevance checks: everyday descriptions must surface the right provisions and guides."""
import pytest

from services.matcher import match

CASES = [
    ("My employer has not paid my salary for the last three months", "cow_17", "salary_unpaid"),
    ("Police are refusing to register my FIR for a stolen phone", "bnss_173_4", "fir_refused"),
    ("My husband beats me and his mother keeps demanding dowry", "bns_85", "domestic_violence"),
    ("I bought a phone online, it is defective and the seller refuses a refund", "cpa_2_47", "consumer_complaint"),
    ("Someone called pretending to be from my bank and took money through UPI", "rbi_liability", "cyber_fraud"),
    ("The cheque my friend gave me for the loan has bounced", "nia_138", "cheque_bounce"),
    ("My landlord is not returning my security deposit", "mta_2021", "tenancy_dispute"),
    ("My manager touches me inappropriately at the office", "posh_2n", "workplace_harassment"),
    ("I was hit by a car and the driver ran away", "mva_161", "road_accident"),
    ("My son took my house and does not take care of me", "mwpsc_4", "senior_citizen"),
    ("Police arrested my brother last night and are not telling us why", "bnss_47", "arrest_rights"),
    ("I want to know the status of my pension file in the government office", "rti_3", "rti_request"),
    ("Upper caste neighbours insulted me using my caste name in public", "poa_3", "caste_atrocity"),
]


@pytest.mark.parametrize("query,law_id,guide_id", CASES)
def test_expected_law_in_top_three(query, law_id, guide_id):
    result = match(query)
    top = [law["id"] for law in result["laws"][:3]]
    assert law_id in top, f"{law_id} not in top 3 {top}"


@pytest.mark.parametrize("query,law_id,guide_id", CASES)
def test_expected_guide(query, law_id, guide_id):
    result = match(query)
    assert result["guide"] is not None
    assert result["guide"]["id"] == guide_id


@pytest.mark.parametrize("query,law_id,guide_id", CASES)
def test_templates_suggested(query, law_id, guide_id):
    assert match(query)["templates"], "every matched problem should suggest at least one document"


def test_irrelevant_query_has_no_strong_match():
    result = match("what is the weather like today")
    assert not result["strong_match"]
    assert result["laws"] == []
