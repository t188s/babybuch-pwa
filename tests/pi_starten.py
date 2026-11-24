import os, sys
os.chdir(sys.argv[1]); sys.path.insert(0, sys.argv[1])
import app
app.db_einrichten()
app.app.run(host="127.0.0.1", port=8770, threaded=False)
