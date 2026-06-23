import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyHealth,
  classifyLoginPage,
  classifyLoginRedirect,
  normalizeBaseUrl,
} from "./verify-production.mjs";

test("normalizeBaseUrl strips trailing slashes", () => {
  assert.equal(
    normalizeBaseUrl(" https://makxas-front.vercel.app/// "),
    "https://makxas-front.vercel.app",
  );
});

test("classifyHealth accepts only the makxas-front health payload", () => {
  assert.equal(classifyHealth({ status: 200, body: { service: "makxas-front", status: "ok" } }).ok, true);
  assert.equal(classifyHealth({ status: 503, body: { service: "makxas-front", status: "degraded" } }).ok, false);
});

test("classifyLoginRedirect requires same-origin login next preservation", () => {
  assert.equal(
    classifyLoginRedirect({
      status: 307,
      location: "https://makxas-front.vercel.app/login?next=%2Fdashboard",
      baseURL: "https://makxas-front.vercel.app",
      expectedNext: "/dashboard",
    }).ok,
    true,
  );
  assert.equal(
    classifyLoginRedirect({
      status: 307,
      location: "https://example.com/login?next=%2Fdashboard",
      baseURL: "https://makxas-front.vercel.app",
      expectedNext: "/dashboard",
    }).reason,
    "cross_origin_redirect",
  );
});

test("classifyLoginPage accepts recognizable login copy", () => {
  assert.equal(classifyLoginPage({ status: 200, body: "反響対応を始めるにはログインしてください。Googleでログイン" }).ok, true);
  assert.equal(classifyLoginPage({ status: 404, body: "Googleでログイン" }).ok, false);
});

test("classifyLoginPage accepts a Japanese Next.js app shell", () => {
  assert.equal(
    classifyLoginPage({
      status: 200,
      body: "<!DOCTYPE html><html lang=\"ja\"><script src=\"/_next/static/chunks/app.js\"></script></html>",
    }).ok,
    true,
  );
});
