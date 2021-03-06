// require("./lib/social");
// require("./lib/ads");
// var track = require("./lib/tracking");

require("component-responsive-frame/child");

var $ = require("./lib/qsa");
var delegate = require("./lib/delegate");
var colors = require("./lib/colors");

var ns = "http://www.w3.org/2000/svg";
var svgContainer = $.one(".svg-container");
var statewideSVG = $.one(".statewide.map svg");
var metroContainer = $.one(".metro.map");
var metroSVG = $.one(".metro.map svg");

// the poor man's React DOM helper
var dom = function(tag, attrs, children) {
  var element = document.createElementNS(ns, tag);
  if (attrs && attrs instanceof Array) {
    children = attrs;
    attrs = false;
  }
  if (attrs) for (var k in attrs) {
    element.setAttribute(k, attrs[k]);
  };
  if (children) children.forEach(c => element.appendChild(c));
  return element;
};

var removeSVGClass = (el, c) => el.setAttribute("class", el.getAttribute("class").replace(c, ""));
var addSVGClass = (el, c) => el.setAttribute("class", el.getAttribute("class") + " " + c);

// add filters
[statewideSVG, metroSVG].forEach(function(svg) {
  var [x, y, width, height] = svg.getAttribute("viewBox").split(" ").map(Number);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  var defs = dom("defs", [
    dom("filter", { id: "color-twist" }, [
      dom("feComponentTransfer",
        ["R","G","B"].map(c => dom("feFunc" + c, {
          type: "linear",
          slope: 2,
          intercept: 0
        }))
      )
    ])
  ]);
  svg.appendChild(defs);
});

var details = $.one(".details");
var notes = $.one(".notes");

//create the zoom rectangle, handle modal button
var rectangle = dom("rect", {
  x: 45,
  y: 37,
  width: 65,
  height: 67,
  "class": "zoom-box"
});
statewideSVG.appendChild(rectangle);

rectangle.addEventListener("click", function() {
  metroContainer.classList.remove("hidden");
});

$.one(".close-button").addEventListener("click", function() {
  metroContainer.classList.add("hidden");
});

var commafy = n => {
  var fixed = (n * 1).toFixed(2);
  var dot = fixed.indexOf(".");
  for (var i = dot - 3; i > 0; i -= 3) {
    fixed = fixed.slice(0, i) + "," + fixed.slice(i);
  }
  return fixed;
};

var highlightDistrict = function(id) {
  var data = districts[id];
  $(".district.selected").forEach(el => removeSVGClass(el, "selected"));
  $(`.district[id="${id}"]`).forEach(el => addSVGClass(el, "selected"));
  details.innerHTML = `
<h2>Selected: District #${id}</h2>
<h3>Senate</h3>
<table class="senate">
  <thead>
    <tr>
      <th>Name
      <th>Regular
      <th>Special
      <th>Total
  <tbody>
    ${data.Senate.legislators.map(l => `
    <tr>
      <td>${l.last}, ${l.first}
      <td>$${commafy(l.regular)}
      <td>$${commafy(l.special)}
      <td>$${commafy(l.total)}
    `).join("")}
</table>

<h3>House</h3>
<table class="house">
  <thead>
    <tr>
      <th>Name
      <th>Regular
      <th>Special
      <th>Total
  <tbody>
    ${data.House.legislators.map(l => `
    <tr>
      <td>${l.last}, ${l.first}
      <td>$${commafy(l.regular)}
      <td>$${commafy(l.special)}
      <td>$${commafy(l.total)}
    `).join("")}
</table>
  `;
  details.classList.remove("pending");
  notes.innerHTML = window.notes[id] ? "Note: " + window.notes[id].note : "";
};

// click for details
delegate(svgContainer, "click", ".district", function() {
  var id = this.getAttribute("id");
  if (!id) return;
  highlightDistrict(id);
  selectDistrict.value = id;
});

var columns = ["regular", "special", "total"];

var makeBounds = function() {
  var b = {};
  columns.forEach(p => b[p] = { min: Infinity, max: 0 });
  return b;
}

// organize data and paint
var bounds = makeBounds();
bounds.Senate = makeBounds();
bounds.House = makeBounds();

var districts = {};

window.perdiem.forEach(function(p) {
  if (!districts[p.district]) districts[p.district] = {
    Senate: {
      legislators: [],
      regular: 0,
      special: 0,
      total: 0
    },
    House: {
      legislators: [],
      regular: 0,
      special: 0,
      total: 0
    },
    regular: 0,
    special: 0,
    total: 0
  };

  var d = districts[p.district];
  d[p.chamber].legislators.push(p);

  //chamber-specific
  columns.forEach(function(session) {
    d[p.chamber][session] += p[session] || 0;
    d[session] += p[session] || 0;
  });
});

var updateBounds = function(data, target) {
  columns.forEach(function(session) {
    if (data[session] < target[session].min) target[session].min = data[session];
    if (data[session] > target[session].max) target[session].max = data[session];
  });
};

for (var k in districts) {
  var district = districts[k];
  updateBounds(district, bounds);
  updateBounds(district.House, bounds.House);
  updateBounds(district.Senate, bounds.Senate);
}

var paint = function(session, chamber) {
  var limits = chamber ? bounds[chamber][session] : bounds[session];
  $.one(".low.value").innerHTML = "$" + commafy(limits.min);
  $.one(".high.value").innerHTML = "$" + commafy(limits.max);
  for (var d in districts) {
    var district = districts[d];
    var value = chamber ? district[chamber][session] : district[session];
    var elements = $(`[id="${d}"]`);
    var scaled = (value - limits.min) / (limits.max - limits.min);
    var fill = colors.hsl(190 - scaled * 50, 50 - scaled * 30, 60 - scaled * 30);
    elements.forEach(el => el.style.fill = fill);
  }
  $(".district.selected").forEach(el => removeSVGClass(el, "selected"));
};

var updateControls = function() {
  var session = $.one(`[name="session"]:checked`).id;
  var chamber = $.one(`[name="chamber"]:checked`).value;
  paint(session, chamber);
};

updateControls();

var selectDistrict = $.one(".district-select");
var updateJump = function() {
  var id = selectDistrict.value;
  if (!id) {
    return $(".district.selected").forEach(el => removeSVGClass(el, "selected"));
  }
  highlightDistrict(id);
};

selectDistrict.addEventListener("change", updateJump);

$.one(".controls").addEventListener("change", updateControls);