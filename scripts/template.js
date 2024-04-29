const fs = require('fs');
const { dataUriFromFile } = require('./utils.js');

const faviconDataURI = 'data:image/png;base64,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';
const imageDir = '../assets/images';
const cssDataURI = '../assets/css/main.css';
const twitterDataURI = dataUriFromFile(`${imageDir}/twitter.svg`);
const githubDataURI = dataUriFromFile(`${imageDir}/github.svg`);
const emailDataURI = dataUriFromFile(`${imageDir}/email.svg`);
const mastodonDataURI = dataUriFromFile(`${imageDir}/mastodon.svg`);
const linkedinDataURI = dataUriFromFile(`${imageDir}/linkedin.svg`);
const logoDataURI = dataUriFromFile(`${imageDir}/privacyTestsLogo.png`);

// The header common to all pages on the site.
const header = () => `
<div class="header">
  <div class="title-wrapper">
    <div class="title">
      <a href="/">
        <img class="pto-logo" alt="PrivacyTests.org logo" src="${logoDataURI}">
        <span>PrivacyTests.org</span>
      </a>
    </div>
  </div>
  <div class="links">
    <div class="link-header">
      <a href="/news">News</a>
    </div>
    <div class="link-header">
      <a href="/about">About</a>
    </div>
    <div class="link-header">
      <a href="https://github.com/privacytests/privacytests.org" title="Source code on github.\nIssues are welcome!"><img alt="Github icon" src="${githubDataURI}"></a>
    </div>
    <div class="link-header">
      <a href="https://twitter.com/privacytests" title="@privacytests on Twitter.\nJoin the discussion!"><img alt="Twitter icon" src="${twitterDataURI}"></a>
    </div>
    <div class="link-header">
      <a href="https://mastodon.social/@privacytests" title="@privacytests on Mastodon.\nJoin the discussion!" rel="me"><img alt="Mastodon icon" src="${mastodonDataURI}"></a>
    </div>
    <div class="link-header">
      <a href="https://www.linkedin.com/company/privacytests-org" title="@privacytests on LinkedIn.\nJoin the discussion!"><img alt="LinkedIn icon" src="${linkedinDataURI}"></a>
    </div>
    <div class="link-header">
      <a href="mailto:contact@privacytests.org" title="Contact me directly via email:\ncontact@privacytests.org.\nFeedback is welcome!"><img alt="Email icon" src="${emailDataURI}"></a>
    </div>
  </div>
</div>`;

// The basic structure of an HTML page
const htmlPage = ({ content, previewImageUrl, canonicalUrl, title }) => {
  const ogImageIfNeeded = previewImageUrl
    ? `
     <meta name="twitter:card" content="summary_large_image"/>
     <meta property="og:image" content="https://privacytests.org/${previewImageUrl}"/>
     <meta property="og:title" content="Which browsers are best for privacy?"/>
     <meta property="og:description" content="An open-source privacy audit of popular web browsers."/>
     <meta property="og:type" content="website"/>
     <meta property="og:url" content="https://privacytests.org/${canonicalUrl}"/>
`
    : '';
  return `<!DOCTYPE html>
<html lang='en'>
  <head>
    <link rel="stylesheet" href="${cssDataURI}">
    <meta charset='UTF-8'/>
    ${ogImageIfNeeded}
    <link href="${faviconDataURI}" rel="icon" type="image/x-icon">
    <title>${title}</title>
    <meta name="description" content="PrivacyTests.org subjects major web browsers to a suite of automated tests to find out: which web browsers offer the best privacy protections?">
    <meta name="format-detection" content="telephone=no">
  </head>
  <body>
    <div class="wrapper">
    ${header()}
    ${content}
    </div>
  </body>
</html>
`;
};

module.exports = { htmlPage };
