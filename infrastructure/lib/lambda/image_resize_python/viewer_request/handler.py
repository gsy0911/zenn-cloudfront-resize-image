import re
from typing import Optional, Tuple
from urllib.parse import parse_qs


def _decode_pattern(text: str) -> Optional[Tuple[str, str, str]]:
    pattern = r"/(?P<prefix>.*)\/(?P<image_name>.*)\.(?P<extension>.*)"
    match = re.match(pattern=pattern, string=text)
    if not match:
        return None
    result = match.groupdict()
    prefix = result["prefix"]
    image_name = result["image_name"]
    extension = result["extension"]
    return prefix, image_name, extension


def _default_handler(event: dict, _):
    print(f"{event=}")
    request = event["Records"][0]["cf"]["request"]
    params = parse_qs(request["querystring"])

    fwd_uri = request["uri"]
    print(f"{fwd_uri=}")
    d = params.get("d")
    if d is None:
        return request

    dimension_match = d[0].split("x")
    width = dimension_match[0]
    height = dimension_match[1]

    result = _decode_pattern(text=fwd_uri)
    if result is None:
        return request
    prefix, image_name, extension = result

    headers = request["headers"]
    header_accept = headers.get("accept", [{"value": ""}])[0]["value"]
    response_extension = "webp" if "webp" in header_accept else "jepg"

    url = [prefix, f"{width}x{height}", response_extension, f"{image_name}.{extension}"]
    # // final modified url is of format /images/200x200/webp/image.jpg
    request["uri"] = f"/{'/'.join(url)}"
    return request


def _detail_specify_handler(event: dict, _):
    print(f"{event=}")
    request = event["Records"][0]["cf"]["request"]
    params = parse_qs(request["querystring"])

    fwd_uri = request["uri"]
    print(f"{fwd_uri=}")
    w = params.get("w")
    if w is None:
        return request
    h = params.get("h")
    if w is None:
        return request

    width = w[0]
    height = h[0]
    target_extension = params.get("extension", ["webp"])[0]

    result = _decode_pattern(text=fwd_uri)
    if result is None:
        return request
    prefix, image_name, extension = result

    url = [prefix, f"{width}x{height}", target_extension, f"{image_name}.{extension}"]
    # // final modified url is of format /images/200x200/webp/image.jpg
    request["uri"] = f"/{'/'.join(url)}"
    return request


def handler(event: dict, context):
    # return _default_handler(event, context)
    return _detail_specify_handler(event, context)
