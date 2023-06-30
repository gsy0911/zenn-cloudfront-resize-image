'use strict';

const utils = require('utils')

exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request;

  // parse the querystrings key-value pairs. In our case it would be w=1280&h=960
  let fwdUri = request.uri;
  console.log(`requestUri: ${fwdUri}`)

  const decodedUriObj = utils.decodeViewerRequestUri(fwdUri)
  const [decodeSuccessData, errorResponse] = utils.decodeQuerystring(request.querystring, decodedUriObj)
  if (errorResponse) {
    callback(null, errorResponse);
    return;
  }
  if (!decodeSuccessData && !errorResponse) {
    callback(null, request);
    return;
  }

  const convertedUri = `${decodedUriObj.prefix}/${decodeSuccessData.querystring}/${decodedUriObj.imageName}.${decodedUriObj.extension}`
  request.uri = convertedUri;
  request.querystring = decodeSuccessData.querystring
  console.log(`converted: ${convertedUri}`)
  callback(null, request);
};
