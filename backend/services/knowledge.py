"""Cached access to the seed knowledge base (laws, judgments, guides) and category labels."""
import json
import os

import config

CATEGORY_LABELS = {
    "criminal": "Criminal Offences",
    "police_rights": "Police, FIR & Arrest Rights",
    "women_safety": "Women's Safety",
    "domestic_violence": "Domestic Violence & Dowry",
    "workplace_harassment": "Sexual Harassment at Work",
    "consumer": "Consumer Rights",
    "cyber": "Cyber Crime & Online Fraud",
    "banking": "Banking & Digital Payments",
    "employment": "Employment & Wages",
    "cheque_bounce": "Cheque Bounce & Money Recovery",
    "tenancy": "Property & Tenancy",
    "road_accident": "Road Accidents",
    "constitutional": "Fundamental Rights",
    "rti": "Right to Information",
    "senior_citizens": "Senior Citizens",
    "family": "Marriage, Divorce & Family",
    "child_protection": "Child Protection",
    "legal_aid": "Free Legal Aid",
    "caste_atrocities": "Caste Atrocities",
}

_cache = {}


def _load(name: str):
    """Load a JSON file from data/, reloading automatically if it changed on disk."""
    path = os.path.join(config.DATA_DIR, name)
    mtime = os.path.getmtime(path)
    hit = _cache.get(name)
    if hit and hit[0] == mtime:
        return hit[1]
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    _cache[name] = (mtime, data)
    return data


def laws():
    return _load("laws.json")


def judgments():
    return _load("judgments.json")


def guides():
    return _load("survival_steps.json")


def law_by_id():
    return {law["id"]: law for law in laws()}


def judgment_by_id():
    return {j["id"]: j for j in judgments()}


def category_label(key: str) -> str:
    return CATEGORY_LABELS.get(key, key.replace("_", " ").title())
