/*jshint esversion: 6 */
$(function() {

    var svg = d3.select("svg"),
        width = $("#lesvg").width(),
        height = $("#lesvg").height();

    //Zoom
    var zoom = d3.zoom()
        .scaleExtent([0.8 / 2, 4])
        .on("zoom", zoomed);
    svg.call(zoom);

    function zoomed() {
        gLinks.attr("transform", d3.event.transform);
        gNodes.attr("transform", d3.event.transform);
    }

    svg.append("g")
        .attr("transform", "translate(" + (width) / 2 + ",200)")
        .append("text").transition()
        .style("font-size", "22px")
        .style("font-family", "Arial")
        .style("fill", "#6633cc")
        .attr("text-anchor", "middle")
        .text("Renseigner un URI ci-dessous puis cliquer sur envoyer.");

    var gLinks,
        gNodes,
        simulation,
        lesManifs,
        oeuvreEnCours, //Suivi de l'oeuvre en cours d'exploration...
        coulOeuvreEnCours; //...Et la couleur correspondante


    var nodes = []; //Les noeuds
    var links = []; //Les arcs
    var dataObj = {}; //Objet des tableaux noeuds/liens (graphe "théorique")


    var tabcouleurs = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#d58fd5", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395", "#6873c6", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"];
    var color = d3.scaleOrdinal(tabcouleurs); //d3.schemeCategory10

    //Initialisation à partir d'un URI auteur
    $('#btn').click(function() {
        $("#dOeuvres").html("");
        $(".card").css('opacity', '0');
        $("#rowErr").css("opacity", "0");
        nodes = []; //Les noeuds
        links = []; //Les arcs
        dataObj = {}; //Objet des tableaux noeuds/liens
        d3.selectAll("svg > *").remove();
        gLinks = svg.append("g");
        gNodes = svg.append("g");
        simulation = d3.forceSimulation()
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide(2))
            .force("charge", d3.forceManyBody().strength(-350)) //.strength(-500)
            .force("link", d3.forceLink().id(function(d) {
                return d.uri;
            }).distance(function(d) {
                //longueur du lien : plus important si lien créateur
                return d.value === "Creator" ? 30 : 0.2;
            }).strength(2));

        var uri = $('#uri').val();
        sparqlData(uri); //=> envoi de la requête initiale
    });
    $('#uri').keydown(function(e) { //Appuie sur entrée => click
        if (e.keyCode == 13) {
            $('#btn').click();
        }
    });


    //Requêtage initial "uri" est l'uri d'un auteur
    function sparqlData(uri) {
        //http://data.bnf.fr/ark:/12148/cb11907966z Hugo
        //http://data.bnf.fr/ark:/12148/cb14793455w Giuliani
        //http://data.bnf.fr/ark:/12148/cb118900414 Balzac

        //point de terminaison
        var endpoint = "http://data.bnf.fr/sparql";
        //Préfixes
        //note: <http://rdvocab.info/ElementsGr2/> est obsolète (FRAD) mais toujours utilisé dans le modèle de données de data.bnf.fr
        var prefixes = "PREFIX skos: <http://www.w3.org/2004/02/skos/core#> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> PREFIX dcterms: <http://purl.org/dc/terms/> PREFIX frad: <http://rdvocab.info/ElementsGr2/>";
        //Requête SPARQL
        var req = "SELECT DISTINCT ?oeuvre ?titre ?nom ?resum (SAMPLE(?depic) as ?fdepic) (SAMPLE(?wDepic) as ?wdepic) ?wikidata WHERE {<" + uri + "> foaf:focus ?person; skos:prefLabel ?nom; skos:exactMatch ?wikidata . ?oeuvre dcterms:creator ?person; rdfs:label ?titre . OPTIONAL { ?oeuvre foaf:depiction ?wDepic. } OPTIONAL { ?person frad:biographicalInformation ?resum.} OPTIONAL { ?person foaf:depiction ?depic. } FILTER (regex(?wikidata, \"^http://wikidata.org/\", \"i\"))} ORDER BY RAND() LIMIT 100";

        //fetch databnf sparql  => ne fonctionne pas sous IE et Edge
        var url = new URL(endpoint),
            params = { queryLn: 'SPARQL', output: 'json', query: prefixes + req, limit: 'none', infer: 'true', Accept: 'application/sparql-results+json' };
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        //Envoi de la requête (asynchrone avec promesse)
        fetch(url)
            .then(reponse => reponse.json())
            .then(data => traitOeuvres(uri, data))
            .catch(err => console.log(err));
    }

    function traitOeuvres(uri, oeuvres) {
        if ((oeuvres.results.bindings.length)) { //S'il y a des résultats
            $("#rowErr").remove();
            $.each(oeuvres.results.bindings, function(i, oeuvre) {
                if (i === 0) { //i === 0 => auteur
                    //depiction auteur + abstract
                    $("#depic").attr('src', typeof oeuvre.fdepic !== "undefined" ? oeuvre.fdepic.value : "#");
                    $(".card-title").html(oeuvre.nom.value);
                    $(".card-text").html(oeuvre.resum.value);
                    $(".card-text").append("<a class='btn btn-outline-light mt-3' target='_blank' href='" + oeuvre.wikidata.value + "'>Voir sur wikidata</a>");
                    $(".card").css('opacity', '1');

                    //nodes index 0 = auteur
                    nodes.push({ titre: oeuvre.nom.value, depic: typeof oeuvre.fdepic !== "undefined" ? oeuvre.fdepic.value : "#", uri: uri, group: "auteur" });
                    nodes.push({ titre: oeuvre.titre.value, depic: typeof oeuvre.wdepic !== "undefined" ? oeuvre.wdepic.value : "/img/oeuvre.png", uri: oeuvre.oeuvre.value, dateEd: "", group: "oeuvre" });
                } else { // Oeuvres
                    nodes.push({ titre: oeuvre.titre.value, depic: typeof oeuvre.wdepic !== "undefined" ? oeuvre.wdepic.value : "/img/oeuvre.png", uri: oeuvre.oeuvre.value, dateEd: "", group: "oeuvre" });
                }
                links.push({ source: uri, target: oeuvre.oeuvre.value, value: "Creator" });
            });
            // var newnodes = supprDoublons(nodes, "id"); //Tableau des noeuds uniques
            dataObj = {
                nodes: nodes,
                links: links
            };


            //Ajout de "cards bootstrap" pour une visualisation sous forme de liste plus traditionnelle
            $.each(dataObj.nodes, function(i, e) { // Itération sur les noeuds
                if (i > 0) { //Si pas l'auteur
                    $("#dOeuvres").append("<div class='card card-oeuvre d-inline-block text-white' data-uri='" + e.uri + "' style='max-width:225px; background-color: " + color(e.titre) + ";'><img class='card-img-top img-rounded' src='" + e.depic + "' alt='illustration oeuvre'><div class='card-body'><h5 class='card-title'>" + e.titre + "</h5><p class='card-text'>Une oeuvre de " + dataObj.nodes[0].titre + "</p><a href='" + e.uri + "' target='_blank' class='btn btn-outline-light btn-sm res-oeuvre' style='white-space: normal;'>Accéder à la ressource</a></div></div>");
                } else if (i === 0) { //Si auteur
                    $("#cardAuteur").css("background-color", color(e.titre));
                }
            });
            $(".card-oeuvre").wrapAll("<div class='card-columns d-inline-block'></div>").css("cursor", "pointer");

            //On accède à la ressource depuis l'oeuvre => pas de propagation des événements (dispatch click)
            $(".res-oeuvre").click(function(e) { e.stopPropagation(); });

            // Click sur "card" oeuvre => dispatch click sur node correspondant
            d3.select('body')
                .selectAll('.card-oeuvre')
                .on("click", function() {
                    var luri = this.dataset.uri;
                    $('html, body').animate({ scrollTop: 0 }, 200);
                    var leNode = d3.selectAll('circle').filter(function(n) { //Le node correspondant à l'oeuvre
                        return n.uri === luri;
                    });
                    leNode.dispatch('click', function() {
                        // PROBLEME à investiguer
                        // dispatch ne rafraichit le graphe que partiellement lors des appels suivants
                        //Solution (provisoire ?) => relancer simulation
                        simulation.alphaTarget(0.05).restart();
                        setTimeout(function() { simulation.alphaTarget(0); }, 1000);
                    });
                });

            renduGraph(0);

        } else { //S'il n'y a pas de résultats
            $("#btn").after("<div id='rowErr' class='alert alert-danger col-6 top-marge' role='alert'>Aucun résultat...</div>");
            $("#rowErr").css("opacity", "1");
        }
    }

    function reqManifs(uri) { //récupération des manifestations liées à une oeuvre
        //point de terminaison
        var endpoint = "http://data.bnf.fr/sparql";
        p = "PREFIX rdarelationships: <http://rdvocab.info/RDARelationshipsWEMI/> PREFIX dcterms: <http://purl.org/dc/terms/> PREFIX bnf-onto: <http://data.bnf.fr/ontology/bnf-onto/> PREFIX foaf: <http://xmlns.com/foaf/0.1/>";
        //Requête SPARQL
        r = "SELECT DISTINCT ?manif ?titre ?isJeune ?desc ?pub ?note ?repro WHERE{ ?manif rdarelationships:workManifested <" + uri + ">; dcterms:title ?titre; dcterms:description ?desc; dcterms:publisher ?pub; <http://rdvocab.info/Elements/note> ?note. OPTIONAL{ ?manif bnf-onto:ouvrageJeunesse ?isJeune.} OPTIONAL{ ?manif <http://rdvocab.info/RDARelationshipsWEMI/electronicReproduction> ?repro.} }";

        //fetch databnf sparql  => ne fonctionne pas sous IE et Edge
        var url = new URL(endpoint),
            params = { queryLn: 'SPARQL', output: 'json', query: p + r, limit: 'none', infer: 'true', Accept: 'application/sparql-results+json' };
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        //Envoi de la requête (asynchrone avec promesse)
        fetch(url)
            .then(reponse => reponse.json())
            .then(data => update(uri, data, false)) //appel pour mettre le graphe à jour
            .catch(err => console.log(err));
    }

    //fonction update => récupération et affichage des manifestations
    function update(uri, data, isClicked) {
        $("#manifsModalBody").html("");
        if ((data.results && data.results.bindings.length) && !isClicked) {
            $.each(data.results.bindings, function(i, manif) {
                var isRepro = typeof manif.repro !== "undefined";
                var lien = isRepro ? manif.repro.value : manif.manif.value;
                nodes.push({ titre: manif.titre.value, pub: manif.pub.value, desc: manif.desc.value, note: manif.note.value, uri: lien, uriOeuvre: uri, isJeune: manif.isJeune, clicked: false, group: "manif" });
                links.push({ source: typeof manif.repro === "undefined" ? manif.manif.value : manif.repro.value, target: uri, value: "workManifested" });
                var imgCard = isRepro ? lien + '.thumbnail' : !manif.isJeune ? '/img/manif.png' : '/img/manifJ.png';
                var stringRepro = isRepro ? "<a href='" + manif.repro.value + "' target='_blank' class='btn btn-outline-light btn-sm' style='white-space: normal;'>Accéder au document numérisé</a>" : "<a href='" + lien.replace("data.bnf.fr", "catalogue.bnf.fr") + "' target='_blank' class='btn btn-outline-light btn-sm' style='white-space: normal;'>Voir dans le catalogue</a>";
                $("#manifsModalBody").append("<div class='card card-manif d-inline-block text-white' data-uri='" + lien + "' style='max-width:200px; background-color: " + coulOeuvreEnCours + "; margin:10px;'><img class='card-img-top img-rounded' src=" + imgCard + " alt='illustration manifestation'><div class='card-body'><h6 class='card-title'>" + manif.titre.value + "</h6><p class='card-text'>" + manif.desc.value + " - " + manif.pub.value + "</p>" + stringRepro + "</div></div>");
            });
            dataObj = {
                nodes: nodes,
                links: links
            };
            renduGraph(1); //Appel de la fonction de rendu du graphe
            setTimeout(function() { //Fenêtre modale après 1200ms 
                $(".card-manif").wrapAll("<div class='card-columns d-inline-block'></div>");
                $("#manifsModalTitle").html("Manifestations liées à <h1><cite><strong>" + oeuvreEnCours + "</strong></cite></h1>" + data.results.bindings.length + " documents").css('border', '5px solid ' + coulOeuvreEnCours).css('color', '#141414').css('padding', '10px 20px');
                $('#manifsModal').modal('show');
            }, 1200);
        } else if (isClicked) { //Si la requête ne contient aucun nouveau noeud
            lesManifs = data.filter(function(m) { //data contient les noeuds
                return m.uriOeuvre === uri;
            });
            $.each(lesManifs, function(i, m) {
                var isRepro = m.uri.indexOf('gallica') > -1;
                var imgCard = isRepro ? m.uri + '.thumbnail' : !m.isJeune ? '/img/manif.png' : '/img/manifJ.png';
                var stringRepro = isRepro ? "<a href='" + m.uri + "' target='_blank' class='btn btn-outline-light btn-sm' style='white-space: normal;'>Accéder au document numérisé</a>" : "<a href='" + m.uri.replace("data.bnf.fr", "catalogue.bnf.fr") + "' target='_blank' class='btn btn-outline-light btn-sm' style='white-space: normal;'>Voir dans le catalogue</a>";
                $("#manifsModalBody").append("<div class='card card-manif d-inline-block text-white' data-uri='" + m.uri + "' style='max-width:200px; background-color: " + coulOeuvreEnCours + "; margin:10px;'><img class='card-img-top img-rounded' src=" + imgCard + " alt='illustration manifestation'><div class='card-body'><h6 class='card-title'>" + m.titre + "</h6><p class='card-text'>" + m.desc + " - " + m.pub + "</p>" + stringRepro + "</div></div>");
            });
            $(".card-manif").wrapAll("<div class='card-columns d-inline-block'></div>");
            $("#manifsModalTitle").html("Manifestations liées à <h1><cite><strong>" + oeuvreEnCours + "</strong></cite></h1>" + lesManifs.length + " documents").css('border', '5px solid ' + coulOeuvreEnCours).css('color', '#141414').css('padding', '10px 20px');
            $('#manifsModal').modal('show');
        }
    }


    //rendu du graphe et événements associés
    function renduGraph(indexRequete) {
        //liens
        var link = gLinks
            .attr("class", "link")
            .selectAll("line")
            .data(dataObj.links);
        var linkEnter = link.enter().append("line")
            .attr("stroke-width", 1)
            .attr("stroke", function(d) { return color(d.value); });

        link = linkEnter.merge(link);

        //Noeuds
        var node = gNodes
            .attr("class", "nodes")
            .selectAll("circle")
            .data(dataObj.nodes);
        var nodeEnter = node.enter().append("circle")
            .attr("r", function(d) { return d.group == "auteur" ? 30 : d.group === "oeuvre" ? 12 : 8; })
            .attr("fill", function(d) {
                var coul = d.isJeune ? "#FDC745" : indexRequete === 1 && d.uri.indexOf('gallica') > -1 ? '#D2CFC8' : indexRequete === 0 ? color(d.titre) : "rgb(51, 102, 204)";
                return coul; //colorManifs(d.titre);
            })
            .style('cursor', function(d) {
                return indexRequete === 0 && d.group !== "auteur" ? 'pointer' : 'auto';
            })
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));
        nodeEnter.on("click", function(d, i) {
                if (i > 0) { //Si pas l'auteur
                    if (!d.clicked) { //L'oeuvre a-t-elle déjà été explorée ?
                        coulOeuvreEnCours = color(d.titre); //Récupération de la couleur liée à l'oeuvre dans une variable globale
                        oeuvreEnCours = d.titre; //Récupération du titre de l'oeuvre dans une variable globale (réutilisation popup)
                        reqManifs(d.uri); //envoi requête manifestations
                        d.clicked = true;
                    } else { //Si l'oeuvre a déjà été traitée, on passe le tableau de noeuds en data
                        coulOeuvreEnCours = color(d.titre);
                        oeuvreEnCours = d.titre;
                        update(d.uri, nodes, true);
                    }
                }
            })
            .on("dblclick", function(d) {
                window.open(d.uri, "_blank");
            })
            .append("title")
            .text(function(d) {
                var title = indexRequete === 0 ? d.titre : d.titre + " - " + d.desc + " - " + d.note + " - " + d.pub;
                return title;
            });

        node = nodeEnter.merge(node);

        link.exit().remove();
        node.exit().remove();

        simulation
            .nodes(dataObj.nodes)
            .on("tick", ticked);

        simulation.force("link")
            .links(dataObj.links);

        function dragstarted(d) {
            if (!d3.event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(d) {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
        }

        function dragended(d) {
            if (!d3.event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        //Fonction itération d3
        function ticked() {
            link
                .attr("x1", function(d) {
                    return d.source.x;
                })
                .attr("y1", function(d) {
                    return d.source.y;
                })
                .attr("x2", function(d) {
                    return d.target.x;
                })
                .attr("y2", function(d) {
                    return d.target.y;
                });

            node
                .attr("cx", function(d) {
                    return d.x;
                })
                .attr("cy", function(d) {
                    return d.y;
                });
        }
    }
});