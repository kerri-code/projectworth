"""Private Light Submissions API. Deploy only with the reviewed API Gateway, IAM,
DynamoDB, WAF and Cognito configuration documented in LIGHT_SUBMISSIONS_DEPLOY.md.

No emails or case narratives are logged. Submissions NEVER publish map records.
"""
import base64
import datetime as dt
import json
import os
import re
import uuid

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

TABLE = boto3.resource("dynamodb").Table(os.environ["LIGHT_SUBMISSIONS_TABLE"])
ALLOWED_ORIGINS = {"https://projectworthwi.org", "https://www.projectworthwi.org"}
ADMIN_SUBS = {x.strip() for x in os.environ.get("LIGHT_SUBMISSIONS_ADMIN_SUBS", "").split(",") if x.strip()}
EXPECTED_ISSUER = os.environ.get("LIGHT_SUBMISSIONS_ISSUER", "")
CATEGORIES = {"survivors-families", "professional-advocates", "partners", "community-policy"}
STATUSES = {"new", "in-review", "closed"}
MAP_INTERESTS = {"keep-private", "interested-anonymous", "interested-first-name", "contact-before-use"}
ID_PATTERN = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ#[0-9a-f-]{36}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def reply(status, data, origin=None):
    headers = {"Content-Type": "application/json", "Cache-Control": "no-store, private",
               "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"}
    if origin in ALLOWED_ORIGINS:
        headers.update({"Access-Control-Allow-Origin": origin, "Vary": "Origin"})
    return {"statusCode": status, "headers": headers,
            "body": json.dumps(data, separators=(",", ":"), default=str)}


def text_field(body, key, limit):
    value = body.get(key, "")
    if not isinstance(value, str):
        raise ValueError("Invalid " + key)
    value = value.strip()
    if len(value) > limit:
        raise ValueError("Too much text in " + key)
    return value


def choices(body, key):
    items = body.get(key, [])
    if not isinstance(items, list) or len(items) > 12:
        raise ValueError("Invalid " + key)
    result = []
    for item in items:
        if not isinstance(item, str) or len(item) > 100:
            raise ValueError("Invalid " + key)
        if item.strip():
            result.append(item.strip())
    return result


def parse_body(event):
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    if len(raw.encode("utf-8")) > 16000:
        raise ValueError("Submission exceeds size limit")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError("Invalid JSON object")
    return payload


def require_admin(event):
    # API Gateway MUST apply the correct Cognito JWT authorizer to GET/PATCH.
    # Never trust body fields, client flags, or custom headers as authorization.
    claims = (((event.get("requestContext") or {}).get("authorizer") or {}).get("jwt") or {}).get("claims") or {}
    subject = claims.get("sub")
    if not ADMIN_SUBS or not subject or subject not in ADMIN_SUBS:
        return None
    if not EXPECTED_ISSUER or claims.get("iss") != EXPECTED_ISSUER:
        return None
    return subject


def submit(event, origin):
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    if not headers.get("content-type", "").lower().startswith("application/json"):
        return reply(415, {"error": "Use application/json"}, origin)
    body = parse_body(event)
    category = text_field(body, "category", 50)
    if category not in CATEGORIES:
        raise ValueError("Please select a submission category")
    name = text_field(body, "name", 80)
    email = text_field(body, "email", 160)
    if email and not EMAIL_PATTERN.match(email):
        raise ValueError("Invalid email")
    message = text_field(body, "message", 2000)
    change = text_field(body, "changeHopedFor", 2000)
    private_note = text_field(body, "privateNote", 2000)
    roles = choices(body, "roles")
    gaps = choices(body, "gaps")
    if not (message or change or private_note or roles or gaps):
        raise ValueError("Please share at least one idea or perspective")
    map_interest = text_field(body, "mapInterest", 45) or "keep-private"
    if map_interest not in MAP_INTERESTS:
        raise ValueError("Invalid sharing preference")
    if map_interest != "keep-private" and not email:
        raise ValueError("Contact email is required to discuss public use later")
    if body.get("adultConfirmed") is not True or body.get("termsAcknowledged") is not True:
        raise ValueError("Please confirm the submission terms and adult participation")
    scope = text_field(body, "locationScope", 50)
    county = text_field(body, "countyRegion", 80)
    state = text_field(body, "stateRegion", 80)
    if scope not in {"Wisconsin", "Outside Wisconsin"}:
        raise ValueError("Invalid location")
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    item_id = now + "#" + str(uuid.uuid4())
    item = {"PK": "LIGHT", "SK": item_id, "submissionId": item_id,
            "category": category, "createdAt": now, "updatedAt": now,
            "status": "new", "name": name, "email": email, "roles": roles,
            "gaps": gaps, "locationScope": scope, "countyRegion": county,
            "stateRegion": state, "message": message, "changeHopedFor": change,
            "privateNote": private_note, "mapInterest": map_interest,
            "publicApproved": False, "publicationStatus": "NOT_AUTHORIZED",
            "source": "light-the-way", "updatedBy": "submission"}
    TABLE.put_item(Item=item, ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)")
    return reply(201, {"ok": True, "submissionId": item_id,
                        "message": "Your light was received privately. Thank you."}, origin)


def list_items(event, origin):
    params = event.get("queryStringParameters") or {}
    try:
        limit = min(max(int(params.get("limit", "50")), 1), 100)
    except (TypeError, ValueError):
        limit = 50
    args = {"KeyConditionExpression": Key("PK").eq("LIGHT"),
            "ScanIndexForward": False, "Limit": limit}
    cursor = params.get("cursor")
    if cursor:
        try:
            sk = base64.urlsafe_b64decode(cursor.encode()).decode("utf-8")
            if not ID_PATTERN.fullmatch(sk):
                raise ValueError()
            args["ExclusiveStartKey"] = {"PK": "LIGHT", "SK": sk}
        except (ValueError, UnicodeError):
            return reply(400, {"error": "Invalid cursor"}, origin)
    data = TABLE.query(**args)
    next_key = data.get("LastEvaluatedKey")
    next_cursor = base64.urlsafe_b64encode(next_key["SK"].encode()).decode() if next_key else None
    return reply(200, {"submissions": data.get("Items", []), "nextCursor": next_cursor}, origin)


def update_status(event, origin, actor):
    data = parse_body(event)
    submission_id = text_field(data, "submissionId", 70)
    status = text_field(data, "status", 30)
    if not ID_PATTERN.fullmatch(submission_id) or status not in STATUSES:
        return reply(400, {"error": "Invalid record or review status"}, origin)
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        TABLE.update_item(Key={"PK": "LIGHT", "SK": submission_id},
            UpdateExpression="SET #s=:s, updatedBy=:actor, updatedAt=:now",
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": status, ":actor": actor, ":now": now})
    except ClientError as err:
        if err.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return reply(404, {"error": "Submission not found"}, origin)
        raise
    return reply(200, {"ok": True, "submissionId": submission_id, "status": status}, origin)


def lambda_handler(event, context):
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    origin = headers.get("origin")
    route = event.get("routeKey", "")
    method = ((event.get("requestContext") or {}).get("http") or {}).get("method", "")
    path = event.get("rawPath", "")
    try:
        if route == "POST /api/light-submissions" or (method == "POST" and path == "/api/light-submissions"):
            return submit(event, origin)
        if route in {"GET /api/light-submissions", "PATCH /api/light-submissions"} or (
            method in {"GET", "PATCH"} and path == "/api/light-submissions"
        ):
            actor = require_admin(event)
            if not actor:
                return reply(403, {"error": "Not authorized"}, origin)
            if method == "GET" or route.startswith("GET "):
                return list_items(event, origin)
            return update_status(event, origin, actor)
        return reply(404, {"error": "Not found"}, origin)
    except (ValueError, TypeError, json.JSONDecodeError) as err:
        return reply(400, {"error": str(err)}, origin)
    except Exception:
        # Never log case narratives, identities, contact information, or request bodies.
        return reply(500, {"error": "Unable to process request. Please try again."}, origin)
