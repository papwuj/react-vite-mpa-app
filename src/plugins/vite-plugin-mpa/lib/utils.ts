import fg from 'fast-glob'
import yargs from 'yargs'
import path from 'path'
import type { MpaOptions } from './options'
import type { Rewrite } from 'connect-history-api-fallback'

const argv: any = yargs.argv

export type PageInfo = Record<
  string,
  {
    entry: string
    filename: string
  }
>

/**
 * return first page path
 */
export function getFirstPage(pages: Record<string, string>, baseUrl: string): string {
  const firstPageName = Object.keys(pages)[0]
  if(baseUrl) {
    baseUrl = baseUrl.replace(/^\//, '').replace(/\/$/, '');
    return `/${baseUrl}/${firstPageName}/index.html`
  } else {
    return `/${firstPageName}/index.html`
  }
}

/**
 * @private
 */
function genFileName(pageName: string, path: string): string {
  const xPath = path === '' ? '' : `${path}/`
  return `${xPath}${pageName}.html`.replace(/^pages\//, '')
}

/**
 * @private
 */
function parseEntryFile(file: string, filters: string[] = []) {
  const fileSplit = file.split('/')
  // const pageName = fileSplit[fileSplit.length - 2]
  const pageName = fileSplit.slice(2, -1).join('/')
  const outputPath = fileSplit.slice(1, fileSplit.length - 2).join('/')
  const result = {
    file,
    pageName,
    outputPath,
    include: filters.includes(pageName) || filters.length === 0,
  }
  return result
}

/**
 * @private
 */
function parseFiles(files: string[], defaultEntries: string) {
  // support --entry & --file & --page to filter
  const args: string =
    (argv.entry as string) || (argv.file as string) || (argv.page as string) || ''
  if (args === '') {
    defaultEntries = ''
  }
  const filters = args
    .split(',')
    .concat(defaultEntries.split(','))
    .filter(_ => _)
  const ret = files.map(file => parseEntryFile(file, filters))
  return {
    allEntries: ret,
    entries: ret.filter(e => e.include),
    args,
  }
}

/**
 * @private
 */
function scanFile2Html(current: string, scanFile: string, filename: string) {
  // support main.ts & main.{ts,js}
  const reStr = `${scanFile.split('.')[0]}[.](.*)`
  const entryRe = new RegExp(reStr)
  return current.replace(entryRe, filename)
}

/**
 * @private
 * @param scanDir - @default 'src/pages'
 * @param scanFile - @default 'main.{js,ts,jsx,tsx}'
 * @param usePath
 * @param ext
 */
function getPagesInfo({ defaultEntries, scanDir, scanFile }: MpaOptions): PageInfo {
  const allFiles = fg.sync(`${scanDir}/**/${scanFile}`.replace('//', '/'))
  // Calc
  const pages = {}
  const result = parseFiles(allFiles, defaultEntries)
  const { entries } = result
  entries.forEach(entry => {
    const { file, pageName, outputPath } = entry
    // @ts-expect-error
    pages[pageName] = {
      entry: file,
      filename: genFileName(pageName, outputPath),
    }
  })
  return pages
}

export function getMPAIO(root: string, options: MpaOptions) {
  const { scanFile, filename } = options
  const pages = getPagesInfo(options)
  const input: Record<string, string> = {}
  Object.keys(pages).map(key => {
    input[key] = path.resolve(root, scanFile2Html(pages[key].entry, scanFile, filename))
  })
  return input
}

/**
 * history rewrite list
 */
export function getHistoryReWriteRuleList(options: MpaOptions): Rewrite[] {

  // console.info("getHistoryReWriteRuleList", options)

  let baseUrl: string = options.base;
  // console.info("baseUrl", baseUrl)

  if(baseUrl) {
    // 替换baseUrl的前后/为空字符串 
    baseUrl = baseUrl.replace(/^\//, '').replace(/\/$/, '');
  }
  // console.info("baseUrl", baseUrl)


  const { scanDir, scanFile, filename, rewrites } = options
  const list: Rewrite[] = rewrites
  list.push({
    from: /^\/$/,
    to: baseUrl? `/${baseUrl}/${scanDir}/index/${filename}`: `./${scanDir}/index/${filename}`,
  })
  if(baseUrl) {
    list.push({
      from: new RegExp(`^/${baseUrl}/$`),
      to: `/${baseUrl}/${scanDir}/index/${filename}`,
    })
    list.push({
      from: new RegExp(`^/${baseUrl}$`),
      to: `/${baseUrl}/${scanDir}/index/${filename}`,
    })
  }

  const pages = getPagesInfo(options)
  const pageKeys = Object.keys(pages)
  // the order of connect-history-api-fallback.rewrites matters!
  // if b starts with a, then a should be placed after b
  // eg: /page should be placed after /page/sub, so that /page/sub won't be interecept by new RegExp(`^/${page}/`) definded by /page
  pageKeys.sort((a, b) => {
    if (a.startsWith(b)) {
      return -1
    } else if (b.startsWith(a)) {
      return 1
    } else {
      return b.length - a.length || a.localeCompare(b)
    }
  })

  pageKeys.map(pageName => {

    let to = `./${scanFile2Html(pages[pageName].entry, scanFile, filename)}`
    if(baseUrl) {
      to = `/${baseUrl}/${scanFile2Html(pages[pageName].entry, scanFile, filename)}`
    }
    // console.info("to", to)

    list.push({
      from: new RegExp(`^/${pageName}/index.html$`), // support pageName/index.html
      to,
    })
    list.push({
      from: new RegExp(`^\/${pageName}.html$`), // support pageName.html, not recommended
      to,
    })
    list.push({
      from: new RegExp(`^\/${pageName}$`), // support pageName, not recommended
      to,
    })
    list.push({
      from: new RegExp(`^/${pageName}/`), // support pageName/{pages}
      to,
    })

    if(baseUrl) {
      // Add support for //${baseUrl}/ prefix

      list.push({
        from: new RegExp(`^/${baseUrl}/${pageName}/index.html$`), // support pageName/index.html
        to,
      })
      list.push({
        from: new RegExp(`^\/${baseUrl}/${pageName}.html$`), // support pageName.html, not recommended
        to,
      })
      list.push({
        from: new RegExp(`^\/${baseUrl}/${pageName}$`), // support pageName, not recommended
        to,
      })
      list.push({
        from: new RegExp(`^/${baseUrl}/${pageName}/`), // support pageName/{pages}
        to,
      })
    }

  })

  // console.info("list", list)

  return list
}
