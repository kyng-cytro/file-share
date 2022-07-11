const express = require('express')
const multer = require('multer')
const mongoose = require('mongoose')
const fs = require('fs');
const fsPromise = require('fs').promises;
const bcrypt = require('bcrypt')
const File = require('./models/File')
const User = require('./models/User')
const Path = require('path')
const filesize = require('filesize')
const bodyParser = require('body-parser')
const cron = require('node-cron');
const requestIp = require('request-ip');
const multerS3 = require("multer-s3-v3");
const aws = require("aws-sdk");

require('dotenv').config()

const app = express()

aws.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

var s3 = new aws.S3({
    endpoint: "s3.us-central-1.wasabisys.com"
})


const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: "file-upload-bucket",
    })
})

const size = filesize.partial({base: 2, standard: "jedec"});
const PORT = process.env.PORT
const CONNECTION_STRING = process.env.MONGO_CONNECT_STRING
const EXTS = ["3g2","3ga","3gp","7z","aa","aac","ac","accdb","accdt","ace","adn","ai","aif","aifc","aiff","ait","amr","ani","apk","app","applescript","asax","asc","ascx","asf","ash","ashx","asm","asmx","asp","aspx","asx","au","aup","avi","axd","aze","bak","bash","bat","bin","blank","bmp","bowerrc","bpg","browser","bz2","bzempty","c","cab","cad","caf","cal","cd","cdda","cer","cfg","cfm","cfml","cgi","chm","class","cmd","code-workspace","codekit","codekit3","coffee","coffeelintignore","com","compile","conf","config","cpp","cptx","cr2","crdownload","crt","crypt","cs","csh","cson","csproj","css","csv","cue","cur","dart","dat","data","db","dbf","deb","default","dgn","dist","diz","dll","dmg","dng","doc","docb","docm","docx","dot","dotm","dotx","download","dpj","ds_store","dsn","dst","dtd","dwg","dxf","editorconfig","el","elf","eml","enc","eot","eps","epub","eslintignore","exe","f4v","fax","fb2","fla","flac","flv","fnt","fon","gadget","gdp","gem","gif","gitattributes","gitignore","go","gpg","gpl","gradle","gz","h","handlebars","hbs","heic","hlp","hs","hsl","htm","html","ibooks","icma","icml","icns","ico","ics","idx","iff","ifo","image","img","iml","in","inc","indd","inf","info","ini","inv","iso","j2","jar","java","jpe","jpeg","jpg","js","json","jsp","jsx","key","kf8","kit","kmk","ksh","kt","kts","kup","less","lex","licx","lisp","list","lit","lnk","lock","log","lua","m","m2v","m3u","m3u8","m4","m4a","m4r","m4v","map","master","mc","md","mdb","mdf","me","mi","mid","midi","mk","mkv","mm","mng","mo","mobi","mod","mov","mp2","mp3","mp4","mpa","mpd","mpe","mpeg","mpg","mpga","mpp","mpt","msg","msi","msu","nef","nes","nfo","nix","npmignore","ocx","odb","ods","odt","ogg","ogv","one","ost","otf","ott","ova","ovf","p12","p7b","pages","part","partial","pbix","pcd","pdb","pdf","pem","pfx","pgp","ph","phar","php","pid","pkg","pl","plist","pm","png","po","pom","pot","potx","ppk","pps","ppsx","ppt","pptm","pptx","prop","ps","ps1","psd","psp","pst","pub","py","pyc","qt","ra","ram","rar","raw","rb","rdf","rdl","reg","resx","retry","rm","rom","rpm","rpt","rsa","rss","rst","rtf","ru","rub","sass","save","scss","sdf","sed","sesx","sh","sit","sitemap","sketch","skin","sldm","sldx","sln","sol","sphinx","sql","sqlite","srt","step","stl","sub","svg","swd","swf","swift","swp","sys","tar","tax","tcsh","tex","tfignore","tga","tgz","tif","tiff","tmp","tmx","torrent","tpl","ts","tsv","tsx","ttf","twig","txt","udf","vb","vbproj","vbs","vcd","vcf","vcs","vdi","vdx","vmdk","vob","vox","vscodeignore","vsd","vss","vst","vsx","vtx","war","wav","wbk","webinfo","webm","webp","wma","wmf","wmv","woff","woff2","wpd","wps","wsf","xaml","xcf","xcodeproj","xfl","xlb","xlc","xlm","xls","xlsb","xlsm","xlsx","xlt","xltm","xltx","xml","xpi","xps","xrb","xsd","xsl","xspf","xz","yaml","yml","z","zip","zsh"];

app.set('view engine', 'ejs')

app.use(bodyParser.urlencoded({ extended: false }))

app.use(bodyParser.json())

app.use(requestIp.mw())

mongoose.connect(CONNECTION_STRING)

cron.schedule('*/30 * * * *', async () => {
    fs.readdir('cache', (err, files) => {
        if (err) throw err;
        for (const file of files) {
          fs.unlink(Path.join("cache", file), err => {
            if (err) throw err;
          });
        }
        console.log("Deleted Cache")
      });
});

app.get('/', (req, res) => {
    return res.render("index");
})

app.post('/upload', upload.single('file-upload') , async (req, res) => {
    const fileData = {
        path: req.file.key, //`https://s3.us-central-1.wasabisys.com/file-upload-bucket/${req.file.key}`, //might switch back later
        originalName: req.file.originalname,
        fileName: req.file.originalname.split(".")[0],
        fileType: Path.extname(req.file.originalname).toLowerCase().slice(1),
        fileSize: size(req.file.size),
        createdAt: new Date()
    };
    const userData = {
        ip: `${req.clientIp}`,
        fileName: fileData.originalName,
        createdAt: fileData.createdAt
    }
    if(req.body.password != null && req.body.password != "" ){
        fileData.password = await bcrypt.hash(req.body.password, 10)
    };
    const file = await File.create(fileData);
    await User.create(userData)
    return res.render('index', {link : `${req.headers.origin}/view/${file.id}`});
})

app.get('/view/:id', async (req, res) => {
    try{
        fileInfo = await File.findById(req.params.id)
        return res.render('viewfile', {file: fileInfo, ext: EXTS.includes(fileInfo.fileType) ? fileInfo.fileType : 'data'});
    }
    catch{
        return res.status(404).render('404');
    }
})

app.post('/download', async (req, res) => {
    if(req.body.id == null){
        return res.status(404).render('404');
    }
    try{
        fileInfo = await File.findById(req.body.id);
        params = {Bucket: "file-upload-bucket",Key: fileInfo.path}
        if(fileInfo.password == null){
            fileInfo.downloadCount += 1
            fileInfo.save()
            const data = await s3.getObject(params).promise();
            await fsPromise.writeFile(`./cache/${fileInfo.originalName}`, data.Body);
            return res.download(`./cache/${fileInfo.originalName}`,fileInfo.originalName)
        }
        else{
            if(await bcrypt.compare(req.body.password, fileInfo.password)){
                fileInfo.downloadCount += 1
                fileInfo.save()
                const data = await s3.getObject(params).promise();
                await fsPromise.writeFile(`./cache/${fileInfo.originalName}`, data.Body);
                return res.download(`./cache/${fileInfo.originalName}`,fileInfo.originalName)                
            }
            else{
                return res.render('viewfile', {file: fileInfo, ext: EXTS.includes(fileInfo.fileType) ? fileInfo.fileType : 'data', error: 'Invalid Password'})
            }
        }
    }
    catch(e){
        console.log(e)
        return res.render('404');
    }
})

app.get('*', function(req, res){
    return res.status(404).render('404')
});

app.listen(PORT, () => {console.log(`server running on port ${PORT}`)})