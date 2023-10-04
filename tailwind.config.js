const plugin = require('tailwindcss/plugin');
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  mode: "jit",
  content: [
    "./src/pages/**/*.{js,jsx,ts,tsx}",
    "./src/lib/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    screens: {
      'lg': '1024px',
    },
    extend: {
      colors: {
        "main": "#2b99c5",
        "dark-color": "#201D1D",
        "teal-10": "#CCE8E8",
        "green-10": "#018D8A",
        "gray-10": "#A6A5A5",
        "gray-11": "#363636",
        "gray-12": "#636161",
        "gray-13": "#E9E8E8",
        "primary-1": "#018D8A",
        "primary-2": "#01676C",
        "primary-3": "#80C6C4",
        "primary-4": "#CCE8E8",
        "head-light": "#8B877A",
        "head-low": "#C16D3C",
        "head-ideal": "#42857E",
        "head-high": "#735070",
        "brown-1": "#F6F4F3"
      },
      width: {
        '22': "5.3rem",
        '10': "40px"
      },
      minWidth: {
        'board': "960px",
        'layout': "1440px",
        'job-content': "1300px",
        '64': "16rem"
      },
      boxShadow: {
        'menu-border-top': "inset 0px 1px 0px #363636;",
        'menu-border-bottom': "inset 0px -1px 0px #363636"
      },
      fontFamily: {
        'proxima': ['"Proxima Nova"'],
        'proxima-bold': ['"Proxima Nova Bold"'],
        'alternate-gothic': ['"Alternate Gothic No2 D"']
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    plugin(function ({ addBase, theme }) {
      addBase({
        'h1': { fontSize: theme('fontSize.2xl') },
        'h2': { fontSize: theme('fontSize.xl') },
        'h3': { fontSize: theme('fontSize.lg') }
      })
    }),
  ],
  variants: {
    extend: {
      display: ["group-hover"]
    }
  }
};