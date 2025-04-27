import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { Water } from 'three/examples/jsm/objects/Water.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
// import gsap from 'gsap';

// シーンの作成
const scene = new THREE.Scene();

const rgbeLoader = new RGBELoader();
rgbeLoader.load(
  "src/assets/sky.hdr",
  (environmentMap) => {
    environmentMap.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = environmentMap;
    scene.environment = environmentMap;
  }
);

// カメラの作成
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);

// スクロールでカメラの前後移動
window.addEventListener('wheel', (event) => {
  const delta = event.deltaY;
  camera.position.z += delta * 0.05; // スクロール量に基づいてカメラを前後に移動
  camera.position.z = Math.max(-800, Math.min(0, camera.position.z));  // 範囲制限
});

// レンダラーを作成
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// renderer.toneMapping = THREE.ACESFilmicToneMapping; // トーンマッピングを設定
document.body.appendChild(renderer.domElement);

// 画像を読み込み
const bgTexture = new THREE.TextureLoader().load('/src/assets/sky.jpg');
const backgroundPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(18008, 12000),
    new THREE.MeshBasicMaterial({ map: bgTexture })
);
backgroundPlane.position.set(0, 0, -10000);
scene.add(backgroundPlane);

// モデルを読み込み
const loader = new GLTFLoader();
loader.load("/src/models/model.glb", function (gltf) {
  const loadedModel = gltf.scene;
  scene.add(loadedModel);
  loadedModel.scale.set(20, 20, 20);
  loadedModel.position.z = -600;

  loadedModel.traverse((child) => {
    if (child.isMesh) {
      if (child.name === "ball") {
        child.material = new THREE.MeshPhysicalMaterial({
          color: 0xFFC0CB,       // ピンク寄りの色
          metalness: 0.3,        // 金属感
          roughness: 0.7,        // 反射の具合
          clearcoat: 1.0,        // クリアコート（表面の光沢）
          clearcoatRoughness: 0.1,
          ior: 1.5               
        });
      } else if (child.name === "sea") {
        child.material = new THREE.MeshPhysicalMaterial({
          color: 0x006994,      // 海の色（青系）
          metalness: 0.0,       // 金属的な反射は不要
          roughness: 0.2,       // 滑らかな反射とわずかな粗さ
          transmission: 0.1,    // 透過度（過度な透明さを抑える）
          // transparent: true,    // 透明化を有効化
          opacity: 0.1,         // 不透明度は1.0にして透過は transmission で制御
          thickness: 1.0,       // 屈折の強さ
          clearcoat: 0.0,       // クリアコートはオフ
          ior: 1.33,            // 水の屈折率（約1.33）
          envMapIntensity: 0.5, // 環境マップの反射強度
          side: THREE.DoubleSide // 両面表示
        });
      }
    }
  });
});

// 水面を作成
const waterGeometry = new THREE.PlaneGeometry(10000, 10000);

const waterNormals = new THREE.TextureLoader().load(
  'https://threejs.org/examples/textures/waternormals.jpg',
  (texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  }
);

const water = new Water(waterGeometry, {
  textureWidth: 512,    // 法線マップのテクスチャ解像度（大きいほど詳細な波の表現）
  textureHeight: 512,
  waterNormals: waterNormals, // 法線マップテクスチャ
  alpha: 1.0,           // 水面の透明度（0.0で完全透明、1.0で不透明）
  sunDirection: new THREE.Vector3(0, 1, 0), // 初期の太陽方向（後でupdateSun()で更新）
  sunColor: 0xFFDDBC,   // 太陽の色（反射光の色調整）
  waterColor: 0x001e0f, // 水そのものの色（深海のような色味を表現）
  distortionScale: 3.7, // 波のディストーション量（数値を大きくすると波が荒くなる）
  fog: scene.fog !== undefined // シーンに霧効果があれば水面にも反映
});
water.rotation.x = -Math.PI / 2;
water.position.y = -80;
scene.add(water);

// 太陽の位置調整
const sun = new THREE.Vector3();

const effectController = {
  elevation: 2, // 太陽の高さ（角度）
  azimuth: 180  // 太陽の方位
};

function updateSun() {
  // spherical座標系を利用して太陽の位置を計算
  const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
  const theta = THREE.MathUtils.degToRad(effectController.azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  // スカイシェーダーへ太陽位置を反映
  // sky.material.uniforms['sunPosition'].value.copy(sun);
  // 水面シェーダーにも太陽方向を設定（正規化して使用）
  water.material.uniforms['sunDirection'].value.copy(sun).normalize();
}
updateSun();

// ポストエフェクトを追加
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// UnrealBloomPassを追加
// const bloomPass = new UnrealBloomPass(
//   new THREE.Vector2(window.innerWidth, window.innerHeight),
//   0.1,    // ブルームの強さ
//   0.1,    // ブルームの半径
//   0.1     // 閾値
// );
// composer.addPass(bloomPass);

// const smaaPass = new SMAAPass();
// composer.addPass(smaaPass);

// アニメーションループ
function animate() {
  requestAnimationFrame(animate);
  water.material.uniforms['time'].value += 1.0 / 60.0;  // 時間を更新することで水面に動きを与える
  composer.render();
}
animate();

// ライトを作成
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// ウィンドウリサイズ時の処理
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
