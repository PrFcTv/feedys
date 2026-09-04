/**
 * Tailwind v4 passe par PostCSS, et n’a plus de fichier de configuration : le
 * thème est déclaré en CSS, dans `app/global.css` (`@theme`).
 *
 * ⛔ Le widget n’a rien à voir avec ceci : il est en CSS-en-JS dans son shadow
 *    DOM, sans build de style (04-Architecture/DESIGN.md §1).
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
