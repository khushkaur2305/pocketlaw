"""PocketLaw Flask application entry point."""
from flask import Flask, jsonify, request
from flask_cors import CORS

import config
from routes.documents import bp as documents_bp
from routes.match import bp as match_bp
from routes.search import bp as search_bp
from routes.stats import bp as stats_bp
from routes.survival import bp as survival_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    for bp in (match_bp, survival_bp, documents_bp, search_bp, stats_bp):
        app.register_blueprint(bp, url_prefix="/api")

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "disclaimer": config.DISCLAIMER})

    @app.errorhandler(404)
    def not_found(_err):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Not found"}), 404
        return "Not found", 404

    @app.errorhandler(500)
    def server_error(_err):
        return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    # Build / load the index up front so the first request is fast.
    from rag.retriever import get_retriever

    get_retriever()
    app.run(host="127.0.0.1", port=config.PORT, debug=True)
