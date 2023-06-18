import base64
import re
from io import BytesIO

import boto3
from PIL import Image

# Defaultサイズ
MAX_WIDTH = 1280
MAX_HEIGHT = 960
# DefaultのQuality
DEFAULT_QUALITY = 50
BUCKET = "your-bucket-here"


def resize_image(
    input_image_buffer, width: int, height: int, target_extension: str = "webp", quality: int = 60
) -> bytes:
    original_image = Image.open(input_image_buffer)
    original_width, original_height = original_image.size
    print(f"The original image size is {original_width} wide x {original_height} tall")

    resized_image = original_image.resize((width, height))
    # width, height = resized_image.size
    print(f"The resized image size is {width} wide x {height} tall")
    img_bytes = BytesIO()
    resized_image.save(img_bytes, target_extension, quality=quality)
    return img_bytes.getvalue()


def _default_handler(event: dict, _):
    response = event["Records"][0]["cf"]["response"]
    request = event["Records"][0]["cf"]["request"]
    fwd_uri = request["uri"]
    print(f"{fwd_uri=}")

    status = response["status"]
    print(f"{status=}")
    if status == 403 or status == 404 or status == "403" or status == "404":
        pattern_with_prefix = (
            r"/(?P<prefix>.*)\/(?P<width>\d+)x(?P<height>\d+)\/(?P<required_format>.*)\/(?P<file_name>.*)"
        )
        pattern_without_prefix = r"/(?P<width>\d+)x(?P<height>\d+)\/(?P<required_format>.*)\/(?P<file_name>.*)"

        match_with_prefix = re.match(pattern_with_prefix, fwd_uri)
        match_without_prefix = re.match(pattern_without_prefix, fwd_uri)

        if match_with_prefix:
            result = match_with_prefix.groupdict()
            prefix = result["prefix"]
            file_name = result["file_name"]
            original_key = prefix + "/" + file_name
        elif match_without_prefix:
            result = match_without_prefix.groupdict()
            file_name = result["file_name"]
            original_key = file_name
        else:
            return response

        # 共通
        width = result["width"]
        height = result["height"]
        required_format = "jpeg" if result["required_format"] == "jpg" else result["required_format"]
        print(f"{width=}, {height=}, {required_format=}")

        # 画像の取得
        s3 = boto3.resource("s3")
        bucket = s3.Bucket(BUCKET)
        f = bucket.Object(original_key).get()["Body"]
        img_bytes = resize_image(f, width=width, height=height, target_extension=required_format)

        bucket.Object(fwd_uri).put(Body=img_bytes)
        # 画像をBase64エンコード
        base64_encoded_str = base64.b64encode(img_bytes).decode("utf-8")
        response["status"] = 200
        response["body"] = base64_encoded_str
        response["bodyEncoding"] = "base64"
        response["headers"]["content-type"] = [{"key": "Content-Type", "value": "image/" + required_format}]
        print(f"{response=}")
    return response


def handler(event: dict, _):
    return _default_handler(event, _)
