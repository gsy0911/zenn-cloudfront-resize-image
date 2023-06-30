'use strict';
const querystring = require('querystring');

const MAX_WIDTH = 1280;
const MAX_HEIGHT = 960;
const SKIP_EXTENSION = ["svg"];
const limitations = {
  allowed: {
    dimensions: [{w: 150, h: 210}, {w: 320, h: 240}, {w: 1280, h: 960}],
    quality: [50, 100],
    extension: ["jpg", "jpeg", "png", "JPG", "webp"],
    fit: ["fill", "inside"]
  },
  default: {
    dimension: {w: 320, h: 240},
    quality: 100,
  },
  webpExtension: 'webp'
};


const decodeQuerystring = (requestQuerystring, decodedUriObj) => {
  const params = querystring.parse(requestQuerystring);
  const paramFit = params.fit ? params.fit : "inside"
  const paramWidth = (isNaN(parseInt(params.w)) || parseInt(params.w) <= 0) ? MAX_WIDTH : Math.min(parseInt(params.w), MAX_WIDTH);
  const paramHeight = (isNaN(parseInt(params.h)) || parseInt(params.h) <= 0) ? MAX_HEIGHT : Math.min(parseInt(params.h), MAX_HEIGHT);
  const paramQuality = (isNaN(parseInt(params.quality)) || parseInt(params.quality) <= 0 || parseInt(params.quality) > 100) ? limitations.default.quality : Math.min(parseInt(params.quality), limitations.default.quality);
  const paramExtension = params.ext ? params.ext : "webp"

  // リサイズ対応しない画像フォーマット
  if (SKIP_EXTENSION.includes(decodedUriObj.extension)) {
    // pass
    return [null, null];
  }
  // リサイズ対応画像チェック
  if (!limitations.allowed.extension.includes(decodedUriObj.extension)) {
    // pass
    return [null, null];
  }

  // Qualityの確認
  if (!limitations.allowed.quality.includes(paramQuality)) {
    const errorResponse = {
      status: "500",
      headers: {
        "content-type": [{key: 'Content-Type', value: 'text/plain'}]
      },
      body: `${paramQuality} is not allowed`
    };
    return [null, errorResponse];
  }

  // リサイズ方法チェック
  if (!limitations.allowed.fit.includes(paramFit)) {
    const errorResponse = {
      status: "500",
      headers: {
        "content-type": [{key: 'Content-Type', value: 'text/plain'}]
      },
      body: `${paramFit} is not allowed`
    };
    return [null, errorResponse];
  }

  let width = paramWidth;
  let height = paramHeight;

  let matchFound = false;
  for (let dimension of limitations.allowed.dimensions) {
    if (width === dimension.w && height === dimension.h) {
      matchFound = true;
      break;
    }
  }
  // if no match is found from allowed dimension with variance then set to default dimensions.
  if (!matchFound) {
    width = limitations.default.dimension.w;
    height = limitations.default.dimension.h;
  }

  // final modified url is of format /images/200x200/webp/image.jpg
  const updatedQuerystring = `w=${width}&h=${height}&quality=${paramQuality}&ext=${paramExtension}&fit=${paramFit}`
  const decodeSuccessData = {
    width,
    height,
    quality: paramQuality,
    targetExtension: paramExtension,
    fit: paramFit,
    querystring: updatedQuerystring
  }
  console.log(`width: ${paramWidth} -> ${width}`)
  console.log(`height: ${paramHeight} -> ${height}`)
  console.log(`extension: ${paramExtension} -> fixed`)
  console.log(`quality: ${paramQuality} -> fixed`)
  console.log(`fit: ${paramFit} -> fixed`)
  console.log(`querystring: ${requestQuerystring} -> ${updatedQuerystring}`)

  // 成功した場合
  return [decodeSuccessData, null]
}

const decodeViewerRequestUri = (uri) => {
  // parse the prefix, image name and extension from the uri.
  // In our case /images/image.jpg
  const match = uri.match(/(.*)\/(.*)\.(.*)/);

  const prefix = match[1];
  const imageName = match[2];
  const extension = match[3];
  console.log(`prefix: ${prefix}, imageName: ${imageName}, extension: ${extension}`)

  return {
    prefix,
    imageName,
    extension,
  }
}

const decodeOriginResponseUri = (uri) => {
  // parse the prefix, image name and extension from the uri.
  // uri is: images/w=${width}&h=${height}&quality=${paramQuality}&ext=webp&fit=${paramFit}/image.jpg
  try {
    const match = uri.match(/(.*)\/w=(\d+)&h=(\d+)&quality=(\d+)&ext=(.*)&fit=(.*)\/(.*)\.(.*)/);
    const prefix = match[1];
    const width = parseInt(match[2], 10);
    const height = parseInt(match[3], 10);
    const quality = parseInt(match[4], 10);
    const targetExtension = match[5];
    const fit = match[6];
    const imageName = match[7];
    const extension = match[8];
    console.log(`prefix: ${prefix}, imageName: ${imageName}, extension: ${extension}`)

    return {
      prefix,
      imageName,
      extension,
      width,
      height,
      quality,
      targetExtension,
      fit,
      originalKey: `${prefix}/${imageName}.${extension}`
    }

  } catch (err) {
    // no prefix exist for image
    console.log("no prefix present..");
    const match = uri.match(/w=(\d+)&h=(\d+)&quality=(\d+)&ext=(.*)&fit=(.*)\/(.*)\.(.*)/);
    const prefix = ""
    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    const quality = parseInt(match[3], 10);
    const targetExtension = match[4];
    const fit = match[5];
    const imageName = match[7];
    const extension = match[8];

    return {
      prefix,
      imageName,
      extension,
      width,
      height,
      quality,
      targetExtension,
      fit,
      originalKey: `${imageName}.${extension}`
    }
  }
}

module.exports = {
  decodeQuerystring,
  decodeViewerRequestUri,
  decodeOriginResponseUri,
}
