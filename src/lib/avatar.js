import React from 'react';

// from https://flatuicolors.com/
const defaultColors = [
  '#2ecc71', // emerald
  '#3498db', // peter river
  '#8e44ad', // wisteria
  '#e67e22', // carrot
  '#e74c3c', // alizarin
  '#1abc9c', // turquoise
  '#2c3e50', // midnight blue
];

function sumChars(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i);
  }

  return sum;
}

export const getInitials = (name) => {
  if (!name) {
    return;
  }

  return name
    .split(" ")
    .map(c => c.charAt(0).toUpperCase())
    .join("")
    .concat(name.charAt(1).toUpperCase())
    .substring(0, 2);
}

export const addPx = (num) => {
  if (!isNaN(num)) {
    return num.toString(10) + 'px';
  }
  return num;
}

export const contrast = (hex) => {
  var rgb = hexToRgb(hex);
  var o = Math.round(((parseInt(rgb[0]) * 299) + (parseInt(rgb[1]) * 587) + (parseInt(rgb[2]) * 114)) / 1000);

  return (o <= 180) ? 'dark' : 'light';
}

function hexToRgb(hex) {
  if (hex.charAt && hex.charAt(0) === '#') {
    hex = removeHash(hex);
  }

  if (hex.length === 3) {
    hex = expand(hex);
  }

  var bigint = parseInt(hex, 16);
  var r = (bigint >> 16) & 255;
  var g = (bigint >> 8) & 255;
  var b = bigint & 255;

  return [r, g, b];
}

function removeHash(hex) {
  var arr = hex.split('');
  arr.shift();
  return arr.join('');
}

function expand(hex) {
  return hex
    .split('')
    .reduce(function (accum, value) {
      return accum.concat([value, value])
    }, [])
    .join('');
}

const Avatar = ({
  borderRadius = '100%',
  src,
  srcset,
  name,
  color,
  colors = defaultColors,
  size,
  style,
  onClick,
  className
}) => {

  if (!name) {
    console.error('User has no name!');
    return;
  }

  const abbr = getInitials(name);
  // size = addPx(size);

  const imageStyle = {
    display: 'block',
    borderRadius
  };

  const innerStyle = {
    lineHeight: addPx(size),
    textAlign: 'center',
    borderRadius,
  };

  if (size) {
    size = parseInt(size) + 2;
    size = addPx(size);
    imageStyle.width = innerStyle.width = innerStyle.maxWidth = size;
    imageStyle.height = innerStyle.height = innerStyle.maxHeight = size;
  }

  let inner, classes = ['UserAvatar'];
  if (src || srcset) {
    innerStyle.backgroundImage = `url(${src || srcset})`;
    innerStyle.backgroundSize = "contain"
    innerStyle.backgroundRepeat = "repeat";
    innerStyle.backgroundPosition = "center";
  } else {
    let background;
    if (color) {
      background = color;
    } else {
      // pick a deterministic color from the list
      let i = sumChars(name) % colors.length;
      background = colors[i];
    }

    innerStyle.backgroundColor = background;

    inner = abbr;
  }

  if (innerStyle.backgroundColor) {
    classes.push(`UserAvatar ${contrast(innerStyle.backgroundColor)}`);
  }

  return (
    <div aria-label={name} className={classes.join(' ')} style={style}>
      <div className={`UserAvatarInner ${className}`} style={innerStyle}>
        {inner}
      </div>
    </div>
  );
}

export default Avatar;