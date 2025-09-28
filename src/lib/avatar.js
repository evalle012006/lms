import React, { useState, useEffect } from 'react';

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

// Helper function to validate if URL is potentially valid
const isValidUrl = (str) => {
  if (!str) return false;
  try {
    new URL(str);
    return true;
  } catch {
    // Check for relative URLs or base64 images
    return str.startsWith('/') || str.startsWith('./') || str.startsWith('data:image/');
  }
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
  margin = 2,
  loading = 'lazy', // Add loading prop for better performance
  fallbackDelay = 0, // Delay before showing fallback (useful for loading states)
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [showFallback, setShowFallback] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    if (src || srcset) {
      setImageError(false);
      setImageLoading(true);
      setShowFallback(false);
      
      // If fallbackDelay is set and src is invalid, show fallback after delay
      if (fallbackDelay > 0 && src && !isValidUrl(src)) {
        const timer = setTimeout(() => {
          setShowFallback(true);
          setImageError(true);
        }, fallbackDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [src, srcset, fallbackDelay]);

  if (!name) {
    console.error('Avatar: name prop is required');
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
    position: 'relative', // For loading indicator positioning
  };

  const imageStyle = {
    display: 'block',
    borderRadius,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.2s ease-in-out', // Smooth transition
  };

  // Determine if we should show image
  const imageSource = src || srcset;
  const shouldShowImage = imageSource && !imageError && !showFallback && isValidUrl(imageSource);

  const innerStyle = {
    width: '100%',
    height: '100%',
    borderRadius,
    backgroundColor: shouldShowImage ? 'transparent' : (color || colors[sumChars(name) % colors.length]),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: paddingInPx,
    boxSizing: 'border-box',
    fontSize: `${Math.floor(size * 0.4)}px`,
    color: '#ffffff',
    border: 'none',
    outline: 'none',
    fontWeight: '600', // Make initials more prominent
    letterSpacing: '0.5px', // Better letter spacing for initials
  };

  const handleImageError = (e) => {
    console.warn(`Avatar: Failed to load image for ${name}:`, e.target.src);
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  // Determine CSS classes
  let classes = ['UserAvatar'];
  if (shouldShowImage) {
    classes.push('UserAvatar--image');
  } else {
    classes.push(`UserAvatar--${contrast(innerStyle.backgroundColor)}`);
  }

  // Add loading class if needed
  if (imageLoading && shouldShowImage) {
    classes.push('UserAvatar--loading');
  }

  return (
    <div 
      aria-label={`${name}'s avatar`}
      role="img"
      className={classes.join(' ')} 
      style={{...containerStyle, ...style}} 
      onClick={onClick}
      title={name} // Add tooltip
    >
      <div className={`UserAvatarInner ${className || ''}`} style={innerStyle}>
        {shouldShowImage ? (
          <img
            src={imageSource}
            srcSet={srcset}
            alt={`${name}'s profile picture`}
            style={imageStyle}
            onError={handleImageError}
            onLoad={handleImageLoad}
            loading={loading}
            draggable={false} // Prevent dragging
          />
        ) : (
          <span 
            className="UserAvatar__initials"
            aria-label={`${name} initials: ${abbr}`}
          >
            {abbr}
          </span>
        )}
      </div>
    </div>
  );
};

export default Avatar;