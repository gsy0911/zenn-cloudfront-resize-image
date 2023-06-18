import re
from urllib.parse import parse_qs


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

    pattern = r"/(?P<prefix>.*)\/(?P<image_name>.*)\.(?P<extension>.*)"
    match = re.match(pattern=pattern, string=fwd_uri)
    if not match:
        return request
    result = match.groupdict()
    prefix = result["prefix"]
    image_name = result["image_name"]
    extension = result["extension"]

    url = [prefix, f"{width}x{height}", "webp", f"{image_name}.{extension}"]
    # // final modified url is of format /images/200x200/webp/image.jpg
    request["uri"] = f"/{'/'.join(url)}"
    return request


def handler(event: dict, context):
    return _default_handler(event, context)
