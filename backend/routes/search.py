from flask import Blueprint, jsonify, request

from services import websearch

bp = Blueprint("search", __name__)


@bp.get("/websearch")
def web_search():
    q = (request.args.get("q") or "").strip()
    if len(q) < 3 or len(q) > 300:
        return jsonify({"error": "Query must be between 3 and 300 characters."}), 400
    return jsonify(websearch.search(q))
