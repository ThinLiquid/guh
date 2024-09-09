import { defineConfig } from 'vite'

const jsToBottomNoModule = () => {
  return {
    name: "no-attribute",
    transformIndexHtml(html) {
      html = html.replace(`type="module" crossorigin`, "")
      let scriptTag = html.match(/<script[^>]*>(.*?)<\/script[^>]*>/)[0]
      console.log("\n SCRIPT TAG", scriptTag, "\n")
      html = html.replace(scriptTag, "")
      html = html.replace("<!-- # INSERT SCRIPT HERE -->", scriptTag)
      return html;
    }
  }
}

export default defineConfig({
  build: {
    target: "ES2022"
  },
  plugins: [jsToBottomNoModule()],
})

