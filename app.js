const express = require("express");
const cos = require("ibm-cos-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");

const app = express();
const port = 3000;

app.use(express.static("public"));

const s3 = new cos.S3({ endpoint: process.env.COS_ENDPOINT });
const bucketName = process.env.COS_BUCKET_NAME;

// アップロード
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    acl: "public-read",
    metadata: (_req, file, callback) => {
      callback(null, { fieldName: file.fieldname });
    },
    key: (_req, file, callback) => {
      // ファイル名をUTF-8に変換（日本語文字化けの対応）
      const key = Buffer.from(file.originalname, "latin1").toString("utf8");
      callback(null, key);
    },
  }),
});
app.post("/", upload.single("file"), (req, res) => {
  if (res.statusCode === 200) {
    console.log("Uploaded file successfully");
    console.log(req.file);
  } else {
    console.log("Upload failed");
  }
  res.redirect("/");
});

// バケット内のオブジェクトをリストする
app.get("/api/file", async (_req, res) => {
  try {
    const data = await s3.listObjects({ Bucket: bucketName }).promise();
    const contents = [];
    if (data) {
      for (const content of data.Contents) {
        // オブジェクトをダウンロードするためのリンクを取得する
        const contentUrl = await s3.getSignedUrlPromise("getObject", {
          Bucket: bucketName,
          Key: content.Key,
        });
        contents.push({ ...content, Url: contentUrl });
      }
    }
    res.json(contents);
  } catch (error) {
    console.error(`ERROR: ${error.code} - ${error.message}`);
  }
});

// オブジェクトを削除する
app.delete("/api/file/:filename", async (req, res) => {
  try {
    await s3
      .deleteObject({ Bucket: bucketName, Key: req.params.filename })
      .promise();
    res.end();
  } catch (error) {
    console.error(`ERROR: ${error.code} - ${error.message}`);
    res.status(500).end;
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
