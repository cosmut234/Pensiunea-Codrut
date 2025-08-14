/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [content: ["./**/*.html"] ],
   purge: {
    enabled: true,
    content: ['./**/*.html'],
    options: {
      safelist: ['text-red-500', 'bg-white', 'hover:bg-red-600'] // clase importante
    }
  },
  
  
  
  
  
  
  theme: {
    extend: {},
  },
  plugins: [],
}

