import axios from 'axios';
import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import os from 'os';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

const tempDir = os.tmpdir();

class Pixiv {
    constructor(cookie) {
        this.cookie = cookie;
        this.headers = {
            download: {
                'Accept': '*/*',
                'Accept-Encoding': 'identity',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'DNT': '1',
                'Origin': 'https://www.pixiv.net',
                'Pragma': 'no-cache',
                'Referer': 'https://www.pixiv.net/',
                'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Microsoft Edge";v="126"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'cross-site',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
            },
            metadata: (id) => ({
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                'Cache-Control': 'no-cache',
                'Cookie': `PHPSESSID=${this.cookie}`,
                'Dnt': '1',
                'Pragma': 'no-cache',
                'Referer': `https://www.pixiv.net/en/artworks/${id}`,
                'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Microsoft Edge";v="126"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
            }),
            image: {
                'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.pixiv.net/',
                'Sec-Ch-Ua': '"Microsoft Edge";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
            },
            meta: () => ({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-encoding': 'gzip, deflate',
                'accept-language': 'en-US,en;q=0.9,id;q=0.8',
                'cache-control': 'no-cache',
                'dnt': 1,
                'pragma': 'no-cache',
                'priority': 'u=0, i',
                'Cookie': `PHPSESSID=${this.cookie}`,
                'Sec-Ch-Ua': '"Microsoft Edge";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
            })
        };
    }

    async downloadFile(url, destination) {
        const writer = fs.createWriteStream(destination);
        try {
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                headers: this.headers.download
            });

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } catch (error) {
            throw new Error(`Failed to download file: ${error.message}`);
        }
    }

    async extractZip(zipPath, extractToPath) {
        return fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: extractToPath }))
            .promise();
    }

    async getMetadata(id) {
        const url = `https://www.pixiv.net/ajax/illust/${id}/ugoira_meta?lang=en`;

        try {
            const response = await axios.get(url, { headers: this.headers.metadata(id) });
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new Error(`R-18 works cannot be displayed. Cookie required to download R-18 works.`);
            }
            throw new Error(`Error fetching metadata`);
        }
    }

    parseArtworkId(url) {
        const id = url.split('/').pop();
        if (!/^\d+$/.test(id)) {
            throw new Error("Invalid Pixiv Url");
        }
        return id;
    }

    parseUserId(url) {
        if (/^\d+$/.test(url)) {
            return url;
        }
        let match = url.match(/\/users\/(\d+)/);
        return match ? match[1] : null;
    }

    async createOptimizedMP4(imageDir, frames) {
        console.log(`Creating optimized MP4...`);
        const startTime = Date.now();
    
        const tempDir2 = fs.mkdtempSync(path.join(tempDir, 'mp4-'));
        const finalOutputPath = path.join(tempDir, 'final_output.mp4');
    
        try {
            await Promise.all(frames.map(async (frame, index) => {
                const imagePath = path.join(imageDir, frame.file);
                const outputImage = path.join(tempDir2, `frame-${index.toString().padStart(5, '0')}.png`);
                await sharp(imagePath).png().toFile(outputImage);
            }));
    
            const totalDuration = frames.reduce((sum, frame) => sum + frame.delay, 0) / 1000;
            const repeatCount = Math.max(1, Math.ceil(10 / totalDuration));
    
            return new Promise((resolve, reject) => {
                let ffmpegCommand = ffmpeg()
                    .input(path.join(tempDir2, 'frame-%05d.png'))
                    .inputFPS(1000 / frames[0].delay)
                    .videoCodec('libx264')
                    .outputOptions('-pix_fmt yuv420p');
    
                if (repeatCount > 1) {
                    ffmpegCommand = ffmpegCommand
                        .inputOptions(`-stream_loop ${repeatCount - 1}`)
                        .duration(10);
                }
    
                ffmpegCommand.output(finalOutputPath)
                    .on('end', async () => {
                        console.log(`MP4 created in ${((Date.now() - startTime) / 1000).toFixed(2)} seconds!`);
                        const buffer = fs.readFileSync(finalOutputPath);
                        fs.rmSync(tempDir2, { recursive: true, force: true });
                        resolve(buffer);
                    })
                    .on('error', async (err) => {
                        fs.rmSync(tempDir2, { recursive: true, force: true });
                        reject(err);
                    })
                    .run();
            });
        } catch (err) {
            fs.rmSync(tempDir2, { recursive: true, force: true });
            throw err;
        }
    }

    async pixivVideoDownloader(url) {
        const destination = path.join(tempDir, `${Date.now()}.zip`);
        const unzipPath = path.join(tempDir, `${Date.now()}`);

        try {
            const id = this.parseArtworkId(url);
            const data = await this.getMetadata(id);
            if (!data) return null;

            await this.downloadFile(data.body.originalSrc, destination);
            await this.extractZip(destination, unzipPath);

            const videoBuffer = await this.createOptimizedMP4(unzipPath, data.body.frames);

            this.cleanup(destination, unzipPath);

            return { type: 'mp4', totalFrame: data.body.frames.length, buffer: videoBuffer };
        } catch (error) {
            await this.cleanup(destination, unzipPath);
            throw error;
        }
    }

    async pixivImageDownloader(url) {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer', headers: this.headers.image });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to download image: ${error.message}`);
        }
    }

    async pixivDownloader(input) {
        const id = this.parseArtworkId(input);
        const url = `https://www.pixiv.net/en/artworks/${id}`;
        try {
            const response = await axios.get(url, { headers: this.headers.meta() });

            const preloadDataMatch = response.data.match(/<meta name="preload-data" id="meta-preload-data" content='(.+?)'/);
            if (!preloadDataMatch) {
                console.log('Preload data not found in response.');
                return { status: false };
            }

            const preloadDataObject = JSON.parse(preloadDataMatch[1]);
            const preData = preloadDataObject['illust'][id];
            const { urls, pageCount, tags, illustType } = preData;

            const processedTags = tags['tags']
                .map(tag => {
                    const tagName = tag['tag'].toLowerCase();
                    const tagTranslation = tag?.translation?.en ? ` (${tag.translation.en})` : '';
                    return tagName + tagTranslation;
                })
                .join(', ');

            let data = [];

            if (illustType === 2) {
                const result = await this.pixivVideoDownloader(url);
                data.push(result);
            } else {
                if (urls.original === null) {
                    return { status: false, message: 'R-18 works cannot be displayed. Cookie needed to view R-18 works.' };
                }

                for (let i = 0; i < pageCount; i++) {
                    const pageUrl = Object.fromEntries(
                        Object.entries(urls).map(([key, value]) => [key, value.replace(/_p\d+/, `_p${i}`)])
                    );
                    const buffer = await this.pixivImageDownloader(pageUrl.original);
                    data.push({ type: pageUrl.original.split('.').pop(), buffer });
                }
            }

            return {
                creator: '@ShiroNexo',
                status: true,
                data: {
                    title: preData['title'],
                    alt: preData['alt'],
                    user: preData['userName'],
                    desc: preData['description'],
                    like: preData['likeCount'],
                    view: preData['viewCount'],
                    comment: preData['commentCount'],
                    tags: processedTags,
                    result: data
                }
            };
        } catch (error) {
            console.log("Pixiv Downloader: " + error);
            return {
                creator: '@ShiroNexo',
                status: false,
                message: error.message || 'Unknown error'
            };
        }
    }

    async pixivSearch(query, mode = 'safe', page = 1) {
        try {
            const modes = ['safe', 'r18']
            mode = modes.includes(mode) ? mode : 'safe';
    
            const result = []
            for (let i = 0; i < page; i++) {
                const param = {
                    word: encodeURIComponent(query),
                    order: 'popular_d',
                    mode: mode,
                    p: i + 1,
                    s_mode: 's_tag',
                    type: 'all',
                    lang: 'en'
                }
        
                const { data } = await axios.get(`https://www.pixiv.net/ajax/search/artworks/${encodeURIComponent(query)}?${new URLSearchParams(param).toString()}`, {
                    headers: this.headers.meta()
                });

                if (!data.body.illustManga || data.body.illustManga.data.length === 0) {
                    break;
                }

                result.push(...data.body.illustManga.data);
            }
   
            return {
                status: true,
                data: result
            }
        } catch (error) {
            return {
                status: false,
                message: error.message || 'Unknown error'
            };
        }
    }
    

    async cleanup(destination, unzipPath) {
        try {
            fs.unlinkSync(destination);
            fs.rmSync(unzipPath, { recursive: true, force: true });
        } catch (error) { }
    }
}

export default Pixiv