const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserWebpackPlugin = require('terser-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = function(env, { mode = 'development' } = {}) {
  const isDev = mode === 'development';

  return {
    mode,
    target: 'electron-renderer',
    stats: { children: false },
    optimization: {
      minimizer: [
        new TerserWebpackPlugin({
          extractComments: false,
          terserOptions: {
            ecma: 8,
            module: true,
            compress: {
              keep_fargs: false,
              passes: 2,
              unsafe: true,
              unsafe_arrows: true,
              unsafe_methods: true,
              unsafe_proto: true
            },
            output: {
              comments: false
            }
          }
        })
      ]
    },
    entry: './src/main.ts',
    output: {
      publicPath: 'http://localhost:8080/dist',
      pathinfo: false
    },
    devServer: {
      clientLogLevel: 'silent',
      compress: true,
      overlay: true,
      before(app, { middleware }) {
        middleware.waitUntilValid(() => {
          spawn(
            electron,
            [path.join(__dirname, './index.js'), 'dev-mode'],
            { stdio: 'inherit' }
          ).on('close', process.exit);
        });
      }
    },
    devtool: isDev ? 'eval-source-map' : false,
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
          exclude: /node_modules/
        },
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          options: {
            appendTsSuffixTo: [/\.vue$/],
            transpileOnly: true
          },
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: [
            {
              loader: MiniCssExtractPlugin.loader,
              options: { hmr: isDev }
            },
            'css-loader'
          ]
        },
        {
          test: /\.(png|webp|svg|gif|ttf)$/,
          loader: 'file-loader',
          options: {
            publicPath: 'assets/',
            name: '[name].[ext]',
            emitFile: false,
            esModule: false
          }
        }
      ]
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin(),
      new VueLoaderPlugin(),
      new MiniCssExtractPlugin({ filename: '[name].css' }),
      new CopyWebpackPlugin([
        { from: 'index.html', to: 'index.html' },
        { from: 'src/assets', to: 'assets' }
      ])
    ],
    resolve: {
      extensions: ['.js', '.ts'],
      symlinks: false,
      alias: ['assets', 'css', 'js', 'lang', 'types'].reduce((alias, name) => {
        alias[name] = path.resolve(__dirname, 'src/' + name);
        return alias;
      }, {})
    }
  };
};
