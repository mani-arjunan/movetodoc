import path from "path";
import fs from "fs/promises";
import bp from "body-parser";
import express from "express";
import cors from "cors";

import {
  validateAndSetAccessToken,
  getGoogleAuthToken,
  getUserInfo,
  saveToRedis,
  getRedisData,
  createDoc,
  getUserInfoFromGoogle,
  getDocFromGoogle,
  getDetailsFromDoc,
  appendToDoc,
} from "./utils/index.js";
import { Redis } from "./redis/index.js";
import { environment } from "./environment/index.js";

const app = express();

app.use(
  cors({
    origin: "*",
  }),
);
app.use(bp.json());

app.post("/logout", validateAndSetAccessToken, async (req, res) => {
  const { userId } = req.body;
  const redis = await Redis.client();
  const userData = await getUserInfo(userId, redis);

  if (!userData) {
    res.status(401);
    res.send({
      error: "User not found",
      code: "USER_NOT_FOUND",
    });
    return;
  }
  const newUserData = {
    ...userData,
    userDetails: {},
    token: {},
  };

  await saveToRedis(userId, JSON.stringify(newUserData), redis);

  res.status(200);
  res.send({
    sucess: "Ok",
  });
});

app.post("/append-to-doc", validateAndSetAccessToken, async (req, res) => {
  const redis = await Redis.client();
  const { userId, docId, selectionText, sourceUrl } = req.body;
  const doc = await getDocFromGoogle(res.locals.token, docId);

  if (doc.error) {
    res.status(500);
    res.send({
      error: "Server Error",
      code: "OTHER_ERROR",
    });
    return;
  }

  const { startIndex, currentHeaderTitle } = getDetailsFromDoc(doc);

  if (startIndex === -1) {
    res.status(500);
    res.send({
      error: "Server Error",
      code: "OTHER_ERROR",
    });
    return;
  }

  const docDetails = {
    docId,
    startIndex,
    currentHeaderTitle,
    sourceUrl: sourceUrl || "",
    selectionText: selectionText || "",
  };
  const appendToDocRes = await appendToDoc(res.locals.token, docDetails);

  if (appendToDocRes.error) {
    res.status(500);
    res.send({
      error: "Server Error",
      code: "OTHER_ERROR",
    });
    return;
  }

  res.status(200);
  res.send({
    sucess: "Ok",
  });
});

app.post("/create-doc", validateAndSetAccessToken, async (req, res) => {
  const redis = await Redis.client();
  const { userId, docName } = req.body;
  const userData = await getUserInfo(userId, redis);

  const docs = await createDoc(
    res.locals.token,
    userData,
    userId,
    docName,
    redis,
  );

  await fs.writeFile(
    "../append.json",
    JSON.stringify({ ...docs, token: res.locals.token }),
  );

  if (docs.error) {
    res.status(docs.status);
    res.send({
      error: docs.error,
      code: docs.code,
    });
    return;
  }

  res.status(200);
  res.send({
    success: "Ok",
    data: docs,
    token: res.locals.token,
  });
});

app.post("/list-docs", validateAndSetAccessToken, async (req, res) => {
  const redis = await Redis.client();
  const { userId } = req.body;

  const userData = await getUserInfo(userId, redis);

  if (!userData) {
    res.status(401);
    res.send({
      error: "User not found",
      code: "USER_NOT_FOUND",
    });
    return;
  }

  res.status(200);
  res.send(userData.docs);
});

app.get("/", async (req, res) => {
  const { code: authCode } = req.query || {};

  if (!authCode) {
    res.sendFile(path.resolve() + "/src/templates/error.html");
    return;
  }

  const tokenResponse = await getGoogleAuthToken(authCode);

  if (tokenResponse.error) {
    res.sendFile(path.resolve() + "/src/templates/error.html");
    return;
  }

  const userInfo = await getUserInfoFromGoogle(tokenResponse);
  if (userInfo.error) {
    res.sendFile(path.resolve() + "/src/templates/error.html");
    return;
  }
  const redis = await Redis.client();
  const userData = await getUserInfo(userInfo.sub, redis);
  const temp = {
    userDetails: {
      name: userInfo.name,
      email: userInfo.email,
    },
    token: tokenResponse.refresh_token,
    docs: userData ? userData.docs : [],
  };

  await saveToRedis(userInfo.sub, JSON.stringify(temp), redis);

  const cookieData = {
    refreshToken: tokenResponse.refresh_token,
    userId: userInfo.sub,
  };

  res.cookie("google-auth-token", JSON.stringify(cookieData), {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.sendFile(path.resolve() + "/src/templates/success.html");
});

app.listen(environment.PORT, () => {
  console.log(`listening on port ${environment.PORT}!`);
});
