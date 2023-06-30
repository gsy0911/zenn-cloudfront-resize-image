'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3({region: "ap-northeast-1"});
const Sharp = require('sharp');
const utils = require('utils')

// set the S3 endpoints
const BUCKET = 'your-bucket-here';

exports.handler = (event, context, callback) => {
  const response = event.Records[0].cf.response;

  console.log(`Response status code: ${response.status}`);

  //check if image is not present
  if (response.status === 403 || response.status === 404 || response.status === "403" || response.status === "404") {

    const request = event.Records[0].cf.request;
    const requestQuerystring = request.querystring;
    console.log(`querystring: ${request.querystring}`)
    // if there is no parameters, just pass the response
    if (requestQuerystring === "") {
      callback(null, response);
      return;
    }

    // read the required uri. Ex requestUri: /images/w=${width}&h=${height}&quality=${paramQuality}&ext=webp&fit=${paramFit}/image.jpg
    const requestUri = request.uri;
    // read the S3 key from the path variable.
    // Ex subRequestUri: images/w=${width}&h=${height}&quality=${paramQuality}&ext=webp&fit=${paramFit}/image.jpg
    const subRequestUri = requestUri.substring(1);
    console.log(`requestUri: ${requestUri} -> subRequestUri: ${subRequestUri}`)

    const decodedUriObj = utils.decodeOriginResponseUri(subRequestUri)
    const {
      prefix,
      originalKey,
      imageName,
      extension,
      width,
      height,
      quality,
      targetExtension,
      fit,
    } = decodedUriObj
    console.log(`w=${width}, h=${height}, originalKey: ${originalKey}, requiredFormat: ${targetExtension}, imageName: ${imageName}`)

    // get the source image file
    S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
      // perform the resize operation
      .then(data => Sharp(data.Body)
        .resize({width: width, height: height, fit: fit})
      )
      .then(image => {
        if (targetExtension === "webp") {
          return image.webp({quality: quality}).toBuffer();
        } else if (targetExtension === "png") {
          return image.png().toBuffer();
        } else if (targetExtension === "jpg" || targetExtension === "jpeg") {
          return image.jpeg({quality: quality}).toBuffer();
        } else {
          callback(null, request);
        }
      })
      .then(buffer => {
        // save the resized object to S3 bucket with appropriate object key.
        S3.putObject({
          Body: buffer,
          Bucket: BUCKET,
          ContentType: 'image/' + targetExtension,
          CacheControl: 'max-age=31536000',
          Key: subRequestUri,
          StorageClass: 'STANDARD'
        }).promise()
          // even if there is exception in saving the object we send back the generated
          // image back to viewer below
          .catch(() => {
            console.log("Exception while writing resized image to bucket")
          });

        // generate a binary response with resized image
        response.status = 200;
        response.body = buffer.toString('base64');
        response.bodyEncoding = 'base64';
        response.headers['content-type'] = [{key: 'Content-Type', value: 'image/' + targetExtension}];
        callback(null, response);
      })
      .catch(err => {
        console.log("Exception while reading source image :%j", err);
      });
  } // end of if block checking response statusCode
  else {
    // allow the response to pass through
    callback(null, response);
  }
};
