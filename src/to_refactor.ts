function drawLine(type, x, y, length) {
    var line = document.createElement("div"),
        borderSide = type === "vertical" ? "left" : "top",
        wh = type === "vertical" ? ["width", "height"] : ["height", "width"],
        styleCss = "border-" + borderSide + ": 1px solid blue; position: absolute; top: "
                    + y + "px; left: "
                    + x + "px; " + wh[0] + ": 0px; " + wh[1] + ": " + length + "px";

    line.style = styleCss;
    document.body.appendChild(line);
}

// this used to do nice things when scrolling the visualisation
// it would keep the current context always on the screen
window.addEventListener("scroll", function () {
    var i, words = document.querySelectorAll('.word'), top;
    for (i = 0; i < words.length; ++i) {
        top = words.item(i).getBoundingClientRect().top;
        if (top < 0) {
            words.item(i).querySelector('.name').style = "position: relative; top: " + (-top) + "px; color: rgba(255, 255, 255, 0.5)";
        } else {
            words.item(i).querySelector('.name').style = "position: relative; top: 0";
        }
    }
});