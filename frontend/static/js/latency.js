let getElementsUsingClass = function(className) {
    return document.getElementsByClassName(className);
}
let addCssToClass= function(className, css) {
    let elements = getElementsUsingClass(className);
    for (let i = 0; i < elements.length; i++) {
        let element = elements[i];
        element.style.cssText += css;
    }
}
window.addEventListener('DOMContentLoaded', function() {
    // Add click handlers to the parent span elements with IDs
    let emeraldLegend = document.getElementById("emerald-threshold-legend");
    let amberLegend = document.getElementById("amber-threshold-legend");
    let roseLegend = document.getElementById("rose-threshold-legend");
    let showAllLegend = document.getElementById("show-all-legend");

    if(emeraldLegend) {
        emeraldLegend.addEventListener("click", function() {
            addCssToClass('latency-green','display:block !important;');
            addCssToClass('latency-rose','display:none !important;');
            addCssToClass('latency-amber','display:none !important;');
        });
    }

    if(amberLegend) {
        amberLegend.addEventListener("click", function() {
            addCssToClass('latency-rose','display:none !important;');
            addCssToClass('latency-green','display:none !important;');
            addCssToClass('latency-amber','display:block !important;');
        });
    }

    if(roseLegend) {
        roseLegend.addEventListener("click", function() {
            addCssToClass('latency-amber','display:none !important;');
            addCssToClass('latency-green','display:none !important;');
            addCssToClass('latency-rose','display:block !important;');
        });
    }

    if(showAllLegend) {
        showAllLegend.addEventListener("click", function() {
            addCssToClass('latency-green','display:block !important;');
            addCssToClass('latency-amber','display:block !important;');
            addCssToClass('latency-rose','display:block !important;');
        });
    }
});
