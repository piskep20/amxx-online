const EventEmitter = require("events");
const crypto = require("crypto");
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const config = require('../../config.json');

class AMXX extends EventEmitter{

    constructor(){
        super();

        this.config = config;
        this.db = global.db;

        // Listen for error events
        this.on('error', async err =>{
            await this.db.get('log_error').push({name: err.name, customtext: err.customtext, error: err.error}).write();
        });

        this.output_log = null;
        this.elapsed_time = 0;

        this.on('compile_end', event =>{

            if(!this.checkCompilationOutputErrors(this.output_log)){
                
                // Move compiled plugin from amx path to plugins folder
                fs.rename(event.old_plugin_path, event.new_plugin_path, (err) => {
                    if (err) throw err;
                    console.log('move complete!');
                });

                // Update statistic
                this.db.update('total_compile_times', count => count + 1).write();
            
                this.db.update('total_compile_time', time => (parseFloat(time) + parseFloat(this.elapsed_time)).toFixed(2)).write();

                // Emit success event
                this.emit('compile_end_good', {output_log: this.output_log, elapsed_time: this.elapsed_time, plugin_path: event.plugin_path, plugin_name: event.plugin_name, plugin_id: event.plugin_id});
            
            }else{
                // Update statistic
                this.db.update('total_compile_time', time => (parseFloat(time) + parseFloat(this.elapsed_time)).toFixed(2)).write();

                // Emite error event
                this.emit('compile_end_bad', {output_log: this.output_log, elapsed_time: this.elapsed_time});
            }
        });

        // Listen for files delete event
        this.on('cleanup_files', (id) =>{
            this.cleanUpID(id);
        });
       
    }

    /*
        compilePlugin(plugin_name: string, plugin_value: string)

        plugin_name - name of the plugin
        plugin_value - plugin which needs to be proccessed

        Try to compile plugin in amxxpc

    */

    compilePlugin(plugin_name, version, id){ 

        // Compile working directory
        const compPath = path.join(global.config.AMXX_PATH + '/' + version);

        // Old file locations - 
        const oldFileName = plugin_name.split('.')[0] + '.amxx';
        const oldPluginPath = `${compPath}/${oldFileName}`;

        // New file name and location
        const newFileName = `${id}.amxx`;
        const newPluginPath = path.join(global.config.AMXX_PATH + '/plugins/' + newFileName);

        const startTime = process.hrtime();

        const amxx = spawn('amxxpc.exe', [plugin_name], {
            cwd: compPath,
            shell: true
        });

        amxx.stdout.setEncoding('utf8');
        
        amxx.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);

          // Save time used to compile and output log
          this.elapsed_time = this.parseHrtimeToSeconds(process.hrtime(startTime));
          this.output_log = data;

        });
        
        amxx.stderr.on('data', (data) => {
            // Compiler provides no stderror output??
            console.error(`stderr: ${data}`);
        });
  
        amxx.on('close', (code) => {
            //Compiler closes itself when compile is over 
            console.log(`Compile ended. Code: ${code}`);

            // Emit its done event
            this.emit('compile_end', {code, old_plugin_path: oldPluginPath, new_plugin_path: newPluginPath, plugin_id: id});
        });
    }

    /*
        cleanUpID(id: string)

        id - database id to look into

        Deletes all files used for anonymous compile

    */

    cleanUpID(id){ 

        // Check if record exists
        const files = this.db.get('compiles').find({ id }).value();

        if(files){

            // Delete includes 
            if(files.includes && files.includes.length > 0){
                files.includes.forEach( include => {
                    fs.exists(include, (exists) => {
                        if (exists) {
                            fs.unlink(include, err =>{
                                if (err) this.emit('error', {name: 'delete_file', customtext: 'Error while deleting includes file', error: err});
                            })
                        }
                    });                   
                });
            }

            // Delete plugin
            if(files.plugin){
                fs.unlink(files.plugin, err =>{
                    if (err) this.emit('error', {name: 'delete_file', customtext: 'Error while deleting plugin file', error: err});
                })
            }

        }
    }

    /*
        processPlugin(includes: array)

        parsed_name - parsed filename with id
        plugin_value - plugin which needs to be proccessed

        Process plugin into specific version of amx 

    */

    processPlugin(name, plugin_value){ 
        try {
            this.createFileFromString(name, plugin_value);      
        } catch (error) {
            this.emit('error', {name: 'plugin_file_save', text: 'there was an problem with saving plugin', error})
        }
    }   

    /*
        processInclude(includes: array)

        parsed_name - parsed filename with id
        include_value - include which needs to be proccessed

        Process include into specific version of amx includes 

    */

    processInclude(name, include_value, version){ 
        try {
            this.createFileFromString(name, include_value);
        } catch (error) {
            this.emit('error', {name: 'include_file_save', text: 'there was an problem with saving custom include', error})
        }
    }

    /*
        fileHash(path: string, algorithm: string)

        path - path of the file
        algorithm - specific algorithm which is gonna be used

        Return hash of the specific file
    */

    fileHash(path, algorithm = 'md5') {

        return new Promise((resolve, reject) => {

          // Algorithm depends on availability of OpenSSL on platform
          // Another algorithms: 'sha1', 'md5', 'sha256', 'sha512' ...
          let shasum = crypto.createHash(algorithm);

          try {
            // Create file stream
            let s = fs.ReadStream(path);

            // Wait for data proccess
            s.on('data', function (data) {
                shasum.update(data)
            })

            // Wait for an end
            s.on('end', function () {
                const hash = shasum.digest('hex')
                return resolve(hash);
            });

            } catch (error) {
                return reject(error);
            }
        });
    }


  
    /*
        createFileFromString(name: string, string: string)

        name - filepath with filename and file suffix
        string - actual value of file

        Creates a new file in a specific directory, returns true on succesfull task or 
        false on unseccesfull task.

    */

    createFileFromString(name, string){  

        fs.writeFile(name, string, (err) =>{  
            if(err){
                return this.emit('error', {name: 'delete_file', customtext: 'Error while creating file from string', error: err});
            } 
        });
        
        return;
    }

    /*
        checkCompilationOutputErrors(output)

        output - Compiler output 

        Check if output string contains fail keywords

    */

    checkCompilationOutputErrors(output){
        return output.includes('(compile failed)') ? true : false;
    }

    /*
        generateUniqueID()

        Generates random string using crypto module

    */

    generateUniqueID(){
        return crypto.randomBytes(20).toString('hex');
    }

    /*
        parseHrtimeToSeconds(hrtime)

        Converts hrtime to seconds

    */

    parseHrtimeToSeconds(hrtime) {
        return (hrtime[0] + (hrtime[1] / 1e9)).toFixed(3);
    }

    
}



module.exports = AMXX;