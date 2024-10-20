import React, { useState } from 'react';

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

const sumChars = (str) => {
  return str.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
};

export const getInitials = (name) => {
  if (!name) return '';
  
  // Remove special characters and extra spaces
  const cleanName = name.replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
  
  const parts = cleanName.split(' ');
  if (parts.length === 1) {
    return cleanName.substring(0, 2).toUpperCase();
  }
  return parts.map(part => part.charAt(0).toUpperCase()).join('').substring(0, 2);
};

export const addPx = (num) => {
  return isNaN(num) ? num : `${num}px`;
};

export const contrast = (hex) => {
  const rgb = hexToRgb(hex);
  const brightness = Math.round(((rgb[0] * 299) + (rgb[1] * 587) + (rgb[2] * 114)) / 1000);
  return brightness <= 180 ? 'dark' : 'light';
};

const hexToRgb = (hex) => {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  const bigint = parseInt(hex, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

const Avatar = ({
  borderRadius = '100%',
  src,
  srcset,
  name,
  color,
  colors = defaultColors,
  size = 50,
  style,
  onClick,
  className,
  padding = 4,
  margin = 2
}) => {
  const [imageError, setImageError] = useState(false);

  if (!name) {
    console.error('User has no name!');
    return null;
  }

  const abbr = getInitials(name);
  const sizeInPx = addPx(size);
  const paddingInPx = addPx(padding);
  const marginInPx = addPx(margin);

  const containerStyle = {
    display: 'inline-block',
    margin: marginInPx,
    width: sizeInPx,
    height: sizeInPx,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderRadius,
  };

  const imageStyle = {
    display: 'block',
    borderRadius,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  const hasImage = (src || srcset) && !imageError;

  const innerStyle = {
    width: '100%',
    height: '100%',
    borderRadius,
    backgroundColor: hasImage ? 'transparent' : (color || colors[sumChars(name) % colors.length]),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: paddingInPx,
    boxSizing: 'border-box',
    fontSize: `${Math.floor(size * 0.4)}px`,
    color: '#ffffff',
    border: 'none',
    outline: 'none',
  };

  const handleImageError = () => {
    setImageError(true);
  };

  let classes = ['UserAvatar'];

  if (hasImage) {
    classes.push(`UserAvatar--image`);
  } else {
    classes.push(`UserAvatar--${contrast(innerStyle.backgroundColor)}`);
  }

  return (
    <div 
      aria-label={name} 
      className={classes.join(' ')} 
      style={{...containerStyle, ...style}} 
      onClick={onClick}
    >
      <div className={`UserAvatarInner ${className || ''}`} style={innerStyle}>
        {hasImage ? (
          <img
            src={src || srcset}
            alt={name}
            style={imageStyle}
            onError={handleImageError}
          />
        ) : abbr}
      </div>
    </div>
  );
};

export default Avatar;