/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                'grab-green': '#00B14F',
                'grab-dark': '#1A1A2E',
                'grab-orange': '#FF6B35',
            }
        },
    },
    plugins: [],
}