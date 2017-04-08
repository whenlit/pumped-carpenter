/* global d3 */

const element = document.getElementById('paper'),
      width = element.clientWidth,
      height = element.clientHeight,
      mouseProximityThreshold = 10;
      
init();

function init() {
  let offset = 10,
      rectanglePoints = [[offset,offset],[offset, height - offset],[width - offset, height - offset],[width - offset, offset],[offset, offset]],
      shapes = [rectanglePoints],
      view = getView(),
      state = getState(),
      paths = shapes.map(view.prependPath);

  view.interactions
    .on("mousemove", mousemoved)
    .on("click", clicked);
  
  state.onLineFinished(linefinished);
  
  function mousemoved() {
    var m = d3.mouse(this),
        points = closestPoints(paths, m, mouseProximityThreshold);
    
    if (points.length) {
      state.setClosestPoint(points[0]);
    } else {
      state.setClosestPoint(null);
    }
    
    view.showMouseIndicator(m, state);
  }
  
  function clicked() {
    state.selectPoint();
  }
  
  function linefinished(from, to) {
    // This is not what these paths are for! The idea is they will represent flat segments (polygons) of the paper.
    // Between the array representation and the svg view a whole world of 3d complexity will probably be needed. 
    // But it does conveniently allow us to create more paths for the mouse to latch on to.
    var line = [from, to];
    shapes.push(line);
    paths.push(view.prependPath(line));
  }
}

function getState() {
  var lineFinishedCallback,
      state = {
        sourcePoint: null,
        closestPoint: null,
        isSourcePointSelected: isSourcePointSelected,
        hasClosestPoint: hasClosestPoint,
        setClosestPoint: setClosestPoint,
        selectPoint: selectPoint,
        onLineFinished: onLineFinished
      };
  
  return state;
  
  function selectPoint() {
    if (hasClosestPoint()) {
      if (isSourcePointSelected()) {
        finishLine();
        state.sourcePoint = null;
      } else {
        state.sourcePoint = state.closestPoint;
      }
    }
  }
  
  function isSourcePointSelected() {
    return state.sourcePoint !== null;
  }
  
  function setClosestPoint(point) {
    state.closestPoint = point || null;
  }
  
  function hasClosestPoint() {
    return state.closestPoint !== null;
  }
  
  function onLineFinished(fn) {
    lineFinishedCallback = fn;
  }
  
  function finishLine() {
    if (lineFinishedCallback) {
      lineFinishedCallback(state.sourcePoint, state.closestPoint);
    }
  }
}

function getView() {
  let svg = appendSvg(),
      sourceCircle = appendCircle(),
      line = appendLine(),
      snapCircle = appendCircle(),
      interactions = appendInteractionLayer();
  
  sourceCircle.node().style.fill = 'black';
      
  return {
    svg: svg,
    interactions: interactions,
    showMouseIndicator: showMouseIndicator,
    prependPath: prependPath
  }
  
  function appendSvg() {
    return d3.select(element)
          .append("svg")
          .attr("width", width)
          .attr("height", height);    
  }
  
  function prependPath(points) {
    var line = d3.svg.line()
        .interpolate("linear");

    var path = svg.insert('path', ':first-child')
        .datum(points)
        .attr("d", line);

    return path;
  }
  
  function showMouseIndicator(mousePosition, state) {
    if (state.hasClosestPoint()) {
      showCircle(snapCircle, state.closestPoint);
    } else {
      hideCircle(snapCircle);
    }
    
    if (state.isSourcePointSelected()) {
      showCircle(sourceCircle, state.sourcePoint);
      
      if (state.hasClosestPoint()) {
        showLine(state.sourcePoint, state.closestPoint);
      } else {
        showLine(state.sourcePoint, mousePosition);
      }
    } else {
      hideLine();
      hideCircle(sourceCircle);
    }      
  }
  
  function appendLine() {
    return svg.append('line')
              .attr("display", "none");
  }
  
  function showLine(p1, p2) {
    line.attr("x1", p1[0]).attr("y1", p1[1]).attr("x2", p2[0]).attr("y2", p2[1]);      
    line.attr('display', 'inherit');
  }
  
  function hideLine() {
    line.attr('display', 'none');
  }
  
  function appendCircle() {
    return svg.append('circle')
        .attr("cx", -10)
        .attr("cy", -10)
        .attr("r", 4)
        .attr("display", "none");
  }

  function showCircle(circle, p) {
    circle.attr("cx", p[0]).attr("cy", p[1]);
    circle.attr('display', 'inherit');
  }
  
  function hideCircle(circle) {
    circle.attr('display', 'none');
  }
  
  function appendInteractionLayer() {
    return svg.append('rect')
        .attr("width", width)
        .attr("height", height);
  }
}

function closestPoints(paths, point, proximityThreshold) {
  return paths.map(function(path) {
    return closestPoint(path.node(), point);
  }).filter(function(point) {
    return point.distance < proximityThreshold;
  });
}

function closestPoint(pathNode, point) {
  var pathLength = pathNode.getTotalLength(),
      precision = 8,
      best,
      bestLength,
      bestDistance = Infinity;

  // linear scan for coarse approximation
  for (var scan, scanLength = 0, scanDistance; scanLength <= pathLength; scanLength += precision) {
    if ((scanDistance = distance2(scan = pathNode.getPointAtLength(scanLength))) < bestDistance) {
      best = scan, bestLength = scanLength, bestDistance = scanDistance;
    }
  }

  // binary search for precise estimate
  precision /= 2;
  while (precision > 0.5) {
    var before,
        after,
        beforeLength,
        afterLength,
        beforeDistance,
        afterDistance;
    if ((beforeLength = bestLength - precision) >= 0 && (beforeDistance = distance2(before = pathNode.getPointAtLength(beforeLength))) < bestDistance) {
      best = before, bestLength = beforeLength, bestDistance = beforeDistance;
    } else if ((afterLength = bestLength + precision) <= pathLength && (afterDistance = distance2(after = pathNode.getPointAtLength(afterLength))) < bestDistance) {
      best = after, bestLength = afterLength, bestDistance = afterDistance;
    } else {
      precision /= 2;
    }
  }

  best = [best.x, best.y];
  best.distance = Math.sqrt(bestDistance);
  return best;

  function distance2(p) {
    var dx = p.x - point[0],
        dy = p.y - point[1];
    return dx * dx + dy * dy;
  }
}
