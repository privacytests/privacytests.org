const template = require('./template.js');
const fs = require('fs');

const scriptHtml = `
<script>
  function runTest() {
    const sessionId = Math.random().toString().substr(2);
    window.open(\`https://arthuredelstein.net/test-pages/supercookies.html?mode=read&thirdparty=same&sessionId=\${sessionId}&me=true\`, "_blank", "noopener");
    window.location.href = \`https://arthuredelstein.net/test-pages/supercookies.html?mode=write&thirdparty=same&sessionId=\${sessionId}&me=true\`;
  }
</script>
`

const testButtonElement = `
<div class="content-container">
  <button type="button" id="run-test" onclick="runTest()">Test my Browser</button>
</div>
`

const contentHtml = scriptHtml + testButtonElement;

const main = () => {
  fs.writeFileSync(`${__dirname}/../website/me.html`,
  template.htmlPage({
    content: contentHtml,
    cssFiles: [`${__dirname}/../assets/css/me.css`, `${__dirname}/../assets/css/template.css`]
  }));
};

main();
