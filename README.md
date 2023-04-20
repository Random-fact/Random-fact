<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Random fact </title>
    <script>
      function getRandomFact() {
        const url = 'https://uselessfacts.jsph.pl/random.json?language=en';
        fetch(url)
          .then(response => response.json())
          .then(data => {
            const fact = data.text;
            document.getElementById('fact').innerHTML = fact;
          })
          .catch(error => console.error(error));
      }
    </script>
  </head>
  <body>
    <h1>Random fact </h1>
    <button onclick="getRandomFact()">I want a fact</button>
    <p id="fact"></p>
  </body>
</html>

