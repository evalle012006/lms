# Lending Management System
#### Powered By: NextJS
<br />

<a href="https://nextjs.org">
    <img src="https://assets.vercel.com/image/upload/v1607554385/repositories/next-js/next-logo.png" height="32">
</a>
<a aria-label="Vercel logo" href="https://vercel.com">
  <img src="https://img.shields.io/badge/MADE%20BY%20Vercel-000000.svg?style=for-the-badge&logo=Vercel&labelColor=000">
</a>
<a aria-label="NPM version" href="https://www.npmjs.com/package/next">
  <img alt="" src="https://img.shields.io/npm/v/next.svg?style=for-the-badge&labelColor=000000">
</a>
<a aria-label="License" href="https://github.com/vercel/next.js/blob/canary/license.md">
  <img alt="" src="https://img.shields.io/npm/l/next.svg?style=for-the-badge&labelColor=000000">
</a>
<a aria-label="Join the community on GitHub" href="https://github.com/vercel/next.js/discussions">
  <img alt="" src="https://img.shields.io/badge/Join%20the%20community-blueviolet.svg?style=for-the-badge&logo=Next.js&labelColor=000000&logoWidth=20">
</a>

<br />

### <b>Getting Started</b>
Visit <a aria-label="next.js learn" href="https://nextjs.org/learn">https://nextjs.org/learn</a> to get started with Next.js.

### <b>Documentation</b>

Visit [https://nextjs.org/docs](https://nextjs.org/docs) to view the full documentation.

### <b>Who is using Next.js?</b>

Next.js is used by the world's leading companies. Check out the [Next.js Showcase](https://nextjs.org/showcase) to learn more.

### <b>Community</b>

The Next.js community can be found on [GitHub Discussions](https://github.com/vercel/next.js/discussions), where you can ask questions, voice ideas, and share your projects.

To chat with other community members you can join the [Next.js Discord](https://nextjs.org/discord).

Our [Code of Conduct](https://github.com/vercel/next.js/blob/canary/CODE_OF_CONDUCT.md) applies to all Next.js community channels.

### <b>Contributing</b>

Please see our [contributing.md](/contributing.md).

<br />

## <b>Project Documentation (Lending Management System)</b>

**_NOTE:_**  This project primarily uses <i>npm</i> instead of <i>yarn</i>. Hence the documentation only refers to installation using <i>npm</i>.

### **Installation**

On checkout or clone, run the following: 

``` npm install ```

### **Development**

During development, run the following to watch for changes: 

``` npm run dev ```

### **Testing**

For testing, run the following: 

``` npm run test ```

**_NOTES:_** 

- See package.json for more information. 
- Testins is based on jest. For more information visit Jest github https://github.com/facebook/jest

### **Toast**

The project uses react-toastify. For documentation, refer to this link https://fkhadra.github.io/react-toastify/introduction

### **MongoDB Connection**

The MongoDB Atlas configuration is set to whitelist IP Addresses that will only connect to the app. An error might be encountered when running the app without adding the developers IP Address to the whitelist. 

To add your IP Address, simply login to the MongoDB Atlas account (for Castle Digital) and go to Network Access.

_For more information, please refer/talk to any senior devs_

### **File Structure**

All files that are needed for compile is under the _src_ folder. To import, simply use ``` @/[path] ``` without the ``` src ``` declaration as it is already configured to path under ``` src ```.

### **Sample Files**

For jest, redux and api references, please refer to the sample pages: 

- Jest: ```__tests__/index.test.js ```
- Jest with Mongo: ```__tests__/db.test.js ```
- API Routing: ``` src/pages/api/index.js ```
- MongoDB Query: ``` src/pages/api/db.js ```
- Redux: ``` ```
