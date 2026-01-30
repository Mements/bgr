import boxen from "boxen";
import chalk from "chalk";

export function announce(message: string, title?: string) {
    console.log(
        boxen(chalk.white(message), {
            padding: 1,
            margin: 1,
            borderColor: 'green',
            title: title || "bgr",
            titleAlignment: 'center',
            borderStyle: 'round'
        })
    );
}

export function error(message: string) {
    console.error(
        boxen(chalk.red(message), {
            padding: 1,
            margin: 1,
            borderColor: 'red',
            title: "Error",
            titleAlignment: 'center',
            borderStyle: 'double'
        })
    );
    process.exit(1);
}
