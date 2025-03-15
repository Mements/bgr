bun build $(pwd)/src/index.ts --compile --outfile $(pwd)/bin/meps

export PATH="$(pwd)/bin:$PATH"