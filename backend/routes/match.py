from flask import Blueprint, jsonify, request

from services import matcher, websearch

bp = Blueprint("match", __name__)

MIN_LEN, MAX_LEN = 3, 1000


@bp.post("/match")
def match():
    body = request.get_json(silent=True) or {}
    query = str(body.get("query", "")).strip()
    if len(query) < MIN_LEN:
        return jsonify({"error": "Please describe your problem in a few words."}), 400
    if len(query) > MAX_LEN:
        return jsonify({"error": f"Please keep your description under {MAX_LEN} characters."}), 400

    result = matcher.match(query)
    result["web"] = websearch.search(query) if body.get("include_web") else None
    return jsonify(result)


@bp.get("/examples")
def examples():
    return jsonify({"examples": matcher.EXAMPLES})
