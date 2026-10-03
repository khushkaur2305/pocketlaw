from flask import Blueprint, Response, jsonify, request

import config
from services import drafting

bp = Blueprint("documents", __name__)


@bp.get("/templates")
def list_templates():
    return jsonify({"templates": drafting.template_summaries()})


@bp.get("/templates/<template_id>")
def get_template(template_id):
    t = drafting.get_template(template_id)
    if not t:
        return jsonify({"error": "Template not found"}), 404
    return jsonify(drafting.public_template(t))


def _validated(template_id):
    t = drafting.get_template(template_id)
    if not t:
        return None, None, (jsonify({"error": "Template not found"}), 404)
    body = request.get_json(silent=True) or {}
    values, errors = drafting.validate(t, body.get("values") or {})
    if errors:
        return t, values, (jsonify({"error": "Please correct the highlighted fields.", "fields": errors}), 400)
    return t, values, None


def _warnings(t, values):
    warnings = drafting.check_warnings(t, values)
    if drafting.has_unsupported_chars(values):
        warnings.append("Some characters (for example Hindi or Punjabi script) cannot be shown in the PDF and will "
                        "appear as '?'. Please fill the form in English.")
    return warnings


@bp.post("/documents/<template_id>/preview")
def preview(template_id):
    t, values, err = _validated(template_id)
    if err:
        return err
    return jsonify({
        "title": t["title"],
        "blocks": drafting.render_blocks(t, values),
        "warnings": _warnings(t, values),
        "disclaimer": config.DISCLAIMER,
    })


@bp.post("/documents/<template_id>")
def generate(template_id):
    t, values, err = _validated(template_id)
    if err:
        return err
    pdf = drafting.render_pdf(t, values)
    filename = drafting.safe_filename(t, values)
    return Response(
        pdf,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Warnings": str(len(_warnings(t, values))),
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
