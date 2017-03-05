import * as cli from "build-utils/cli";
import * as path from "path";
import {deleteDirectory, appendFile, copyGlob, copyFile, deleteFile} from "build-utils/fs";
import {exec} from "build-utils/process";
import {appRoutes} from "../app/routes";

cli.command("dev", dev);
cli.command("prod", prod);

cli.run();

export async function dev() {
    await exec("node_modules/.bin/tsc");
    await exec("node_modules/.bin/node-sass --recursive ./app --output ./app");
    await exec("node_modules/.bin/sjs");
}

export async function compileTS() {
    await exec("node_modules/.bin/node-sass --recursive ./aot/app --output ./aot/app");
}

export async function prod() {
    await deleteDirectory("./aot");
    await deleteDirectory("./dist");

    console.log("Copying source files to AOT folder");
    await copyGlob("./app/**/*.ts", "./aot/app");
    await copyGlob("./app/**/*.scss", "./aot/app");
    await copyGlob("./app/**/*.html", "./aot/app");
    await deleteFile("./aot/app/main.ts");
    await copyFile("./tsconfig.json", "./aot/tsconfig.json");

    console.log();
    console.log("Compiling SASS");
    compileTS();

    console.log();
    console.log("Running AOT");
    await exec("node_modules/.bin/ngc -p ./aot");

    console.log();
    console.log("Fix AOT factories");
    await fixAOT();

    console.log();
    console.log("Compiling AOT");
    await copyFile("./build/aot/main.ts", "./aot/app/main.ts");
    await exec("node_modules/.bin/tsc -p ./aot");

    console.log();
    console.log("Bundling");
    await exec("node_modules/.bin/webpack");
}

function fixNgFactory(route) {
    console.log("Fix factory for route: " + route.loadChildren);

    const parts = route.loadChildren.split("#");
    const modulePath = parts[0];
    const moduleName = parts[1];

    const moduleFactoryPath = "./aot" + modulePath + ".ngfactory.ts";
    const moduleFactoryDirPath = path.dirname(moduleFactoryPath);
    const moduleLoaderPath = "./app/common/moduleLoader";
    const moduleFactoryPathRel = path.posix.relative(moduleFactoryDirPath, moduleLoaderPath);

    const template = `
            import {ModuleLoader} from "${moduleFactoryPathRel}";
            ModuleLoader.notifyLoaded("${moduleName}", ${moduleName}NgFactory);`;

    console.log("    " + moduleFactoryPath);
    return appendFile(moduleFactoryPath, template);
}

async function fixAOT() {
    return Promise.all(appRoutes.map(route => fixNgFactory(route)));
}
