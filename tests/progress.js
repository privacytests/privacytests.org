

const progressBar = (parent, fraction) => {
  const progressOuter = document.createElement("div");
  parent.appendChild(progressOuter);
  const progressInner = document.createElement("div");
  progressOuter.appendChild(progressInner);
  progressOuter.style = `
    width: 100%;
    height: 48px;
    background-color: lightgray;
  `;
  progressInner.style = `
    width: ${100*(fraction ?? 0)}%;
    height: 100%;
    background-color: seagreen;
  `;
  return progressOuter;
};

progressBar(document.body, 0.14);
console.log("test1");