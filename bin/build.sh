bun build $(pwd)/src/watch.ts --compile --outfile $(pwd)/bin/bgwatch

bun build $(pwd)/src/index.ts --compile --outfile $(pwd)/bin/bgrun

export PATH="$(pwd):$PATH"