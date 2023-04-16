const template = require('./template.js');
const fs = require('fs');
const path = require('node:path');
const scriptHtml = `
<script>
  function runTest() {
    const sessionId = Math.random().toString().substr(2);
    window.open(\`https://test-pages.privacytests2.org/supercookies.html?mode=read&thirdparty=same&sessionId=\${sessionId}&me=true\`, "_blank", "noopener");
    window.location.href = \`https://test-pages.privacytests2.org/supercookies.html?mode=write&thirdparty=same&sessionId=\${sessionId}&me=true\`;
  }
</script>
`;

const testButtonElement = `
<div class="content-container">
  <button type="button" id="run-test" onclick="runTest()">Test my Browser</button>
</div>
`;

const contentHtml = scriptHtml + testButtonElement;

const main = () => {
  fs.writeFileSync(path.join(__dirname, '/../website/me.html'),
    template.htmlPage({
      content: contentHtml,
      cssFiles: [
        path.join(__dirname, '/../assets/css/me.css'),
        path.join(__dirname, '/../assets/css/template.css')
      ]
    }));
};

main();
