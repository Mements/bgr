bun build $(pwd)/src/index.ts --compile --outfile $(pwd)/bin/bgr

export PATH="$(pwd)/bin:$PATH"