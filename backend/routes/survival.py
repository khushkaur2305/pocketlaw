from flask import Blueprint, jsonify

import config
from services import survival
from services.drafting import template_summaries

bp = Blueprint("survival", __name__)


@bp.get("/situations")
def list_situations():
    return jsonify({"situations": survival.list_guides()})


@bp.get("/situations/<guide_id>")
def get_situation(guide_id):
    guide = survival.get_guide(guide_id)
    if not guide:
        return jsonify({"error": "Situation not found"}), 404
    templates = {t["id"]: t for t in template_summaries()}
    return jsonify({
        **guide,
        "template_details": [templates[t] for t in guide.get("templates", []) if t in templates],
        "disclaimer": config.DISCLAIMER,
    })
